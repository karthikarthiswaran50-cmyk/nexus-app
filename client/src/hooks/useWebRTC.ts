import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { ActiveCallSession, CallType } from '../types';
import { soundEffects } from '../utils/soundEffects';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:80?transport=tcp',
        'turn:openrelay.metered.ca:443',
        'turns:openrelay.metered.ca:443?transport=tcp',
        'turns:openrelay.metered.ca:5349',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: [
        'turn:global.relay.metered.ca:80',
        'turn:global.relay.metered.ca:80?transport=tcp',
        'turn:global.relay.metered.ca:443',
        'turns:global.relay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
};

// Enable Opus Forward Error Correction (FEC) and crystal-clear voice bitrates on mobile data
function preferOpusAndFec(sdp: string): string {
  if (!sdp) return sdp;
  return sdp.replace(/a=fmtp:(\d+) (.*)/g, (match, pt, params) => {
    if (sdp.includes(`a=rtpmap:${pt} opus/48000`)) {
      if (!params.includes('useinbandfec=1')) {
        return `a=fmtp:${pt} ${params};useinbandfec=1;stereo=0;sprop-stereo=0;maxaveragebitrate=64000`;
      }
    }
    return match;
  });
}

// Wait for initial ICE candidates to gather into SDP (Hybrid Trickle + Vanilla ICE)
function waitForIceGathering(pc: RTCPeerConnection, maxTimeoutMs = 600): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      resolve();
    }, maxTimeoutMs);

    const onStateChange = () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', onStateChange);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', onStateChange);
  });
}

export function useWebRTC(session: ActiveCallSession | null) {
  const {
    socket,
    endActiveCall,
    getBufferedCandidates,
    subscribeToIceCandidates,
    unlockAudioContext,
  } = useSocket();
  const { user } = useAuth();

  const [callStatus, setCallStatus] = useState<'initiating' | 'ringing' | 'connecting' | 'connected' | 'ended'>('initiating');
  const [duration, setDuration] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(session?.callType === 'audio');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [peerMicMuted, setPeerMicMuted] = useState(false);
  const [peerCameraOff, setPeerCameraOff] = useState(session?.callType === 'audio');
  const [peerScreenSharing, setPeerScreenSharing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioStreamRef = useRef<MediaStream>(new MediaStream());

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const timerRef = useRef<any>(null);

  // 1. Timer logic
  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [callStatus]);

  // 1.5 Auto-dismiss overlay cleanly when call ends
  useEffect(() => {
    if (callStatus === 'ended') {
      const dismissTimer = setTimeout(() => {
        endActiveCall();
      }, 1500);
      return () => clearTimeout(dismissTimer);
    }
  }, [callStatus, endActiveCall]);

  // 2. Queueing helper for ICE candidates
  const addOrQueueCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('Error adding ICE candidate:', e);
      }
    } else {
      pendingIceCandidatesRef.current.push(candidate);
    }
  }, []);

  const processPendingIceCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return;
    while (pendingIceCandidatesRef.current.length > 0) {
      const candidate = pendingIceCandidatesRef.current.shift();
      if (candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Error adding queued ICE candidate:', e);
        }
      }
    }
  }, []);

  // 3. Bind remoteStream to remoteVideoRef element whenever ready
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(err => console.warn('Remote video play error:', err));
    }
  }, [remoteStream, peerCameraOff]);

  // 4. Initialize WebRTC connection
  useEffect(() => {
    if (!session || !socket || !user) return;

    let isCleanedUp = false;
    pendingIceCandidatesRef.current = [];

    // Ensure audio context is ready
    unlockAudioContext();

    async function initWebRTC() {
      try {
        const wantsVideo = session!.callType === 'video';

        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('Microphone and camera access requires a modern browser and secure HTTPS connection.');
        }

        // Robust mobile & desktop audio constraints
        const audioConstraints: MediaTrackConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };

        let stream: MediaStream;
        try {
          // Attempt optimal HD resolution
          stream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: wantsVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
          });
        } catch (mediaErr) {
          console.warn('Primary HD media constraints failed, attempting standard video:', mediaErr);
          try {
            // Attempt standard video without strict resolution constraints
            stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: wantsVideo ? true : false,
            });
          } catch (standardVideoErr) {
            console.warn('Standard video failed, falling back to crystal-clear voice audio:', standardVideoErr);
            try {
              stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
              setIsCameraOff(true);
            } catch (audioOnlyErr) {
              console.error('Failed to get any media stream:', audioOnlyErr);
              throw new Error('Microphone permission denied. Please allow microphone in browser settings.');
            }
          }
        }

        if (isCleanedUp) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        // Explicitly enable all audio tracks
        stream.getAudioTracks().forEach(t => {
          t.enabled = true;
        });

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Fetch dynamic TURN/STUN ICE Configuration from server
        let rtcConfig: RTCConfiguration = ICE_SERVERS;
        try {
          const configRes = await fetch('/api/webrtc/config').then(r => r.json());
          if (configRes.iceServers && configRes.iceServers.length > 0) {
            rtcConfig = {
              iceServers: configRes.iceServers,
              iceCandidatePoolSize: 10,
              bundlePolicy: configRes.bundlePolicy || 'max-bundle',
            };
          }
        } catch (e) {
          console.warn('Using default STUN/TURN fallback:', e);
        }

        // Create PeerConnection
        const pc = new RTCPeerConnection(rtcConfig);
        peerConnectionRef.current = pc;

        // Add local tracks to PeerConnection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Dedicated remote track handler with direct <audio> pipeline
        pc.ontrack = (event) => {
          console.log('WebRTC ontrack event:', event.track.kind, event.streams);

          if (event.track.kind === 'audio') {
            event.track.enabled = true;

            // Update dedicated audio stream for crystal-clear output
            const existingTracks = remoteAudioStreamRef.current.getAudioTracks();
            existingTracks.forEach(t => remoteAudioStreamRef.current.removeTrack(t));
            remoteAudioStreamRef.current.addTrack(event.track);

            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = remoteAudioStreamRef.current;
              remoteAudioRef.current.muted = false;
              remoteAudioRef.current.volume = 1.0;

              remoteAudioRef.current.play().catch(playErr => {
                console.warn('Audio play auto-blocked by browser, waiting for user interaction:', playErr);
                const unlock = () => {
                  remoteAudioRef.current?.play().catch(() => {});
                  window.removeEventListener('click', unlock);
                  window.removeEventListener('touchstart', unlock);
                };
                window.addEventListener('click', unlock, { once: true });
                window.addEventListener('touchstart', unlock, { once: true });
              });
            }

            event.track.onunmute = () => {
              setPeerMicMuted(false);
              remoteAudioRef.current?.play().catch(() => {});
            };
            event.track.onmute = () => {
              setPeerMicMuted(true);
            };
          }

          if (event.track.kind === 'video') {
            let streamToSet: MediaStream;
            if (event.streams && event.streams[0]) {
              streamToSet = event.streams[0];
            } else {
              streamToSet = new MediaStream([event.track]);
            }
            setRemoteStream(streamToSet);
            setPeerCameraOff(false);

            event.track.onunmute = () => {
              setPeerCameraOff(false);
            };
            event.track.onmute = () => {
              setPeerCameraOff(true);
            };
          }
        };

        // ICE candidate handler
        pc.onicecandidate = (event) => {
          if (event.candidate && socket) {
            socket.emit('call:ice_candidate', {
              targetUserId: session!.peerUser.id,
              candidate: event.candidate,
            });
          }
        };

        // Connection state
        pc.onconnectionstatechange = () => {
          console.log('PeerConnection state:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            soundEffects.stopOutgoingRing();
            soundEffects.playConnectedTone();
            setCallStatus('connected');
            remoteAudioRef.current?.play().catch(() => {});
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            setCallStatus('ended');
          }
        };

        // ICE connection state monitor
        pc.oniceconnectionstatechange = () => {
          console.log('ICE connection state:', pc.iceConnectionState);
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            remoteAudioRef.current?.play().catch(() => {});
          } else if (pc.iceConnectionState === 'failed') {
            if (session?.role === 'caller' && typeof (pc as any).restartIce === 'function') {
              console.log('Restarting ICE connection...');
              (pc as any).restartIce();
            }
          }
        };

        // If caller: create offer & gather candidates
        if (session!.role === 'caller') {
          setCallStatus('ringing');
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: wantsVideo,
          });

          const optimizedOfferSdp = preferOpusAndFec(offer.sdp || '');
          const localOffer = new RTCSessionDescription({ type: 'offer', sdp: optimizedOfferSdp });
          await pc.setLocalDescription(localOffer);

          // Wait brief moment for initial STUN/host candidates to pack into offer SDP
          await waitForIceGathering(pc, 500);

          if (socket) {
            socket.emit('call:initiate', {
              receiverId: session!.peerUser.id,
              callType: session!.callType,
              sdpOffer: pc.localDescription || localOffer,
            });
          }
        }
        // If receiver: handle existing offer & create answer
        else if (session!.role === 'receiver' && session!.sdpOffer) {
          setCallStatus('connecting');
          await pc.setRemoteDescription(new RTCSessionDescription(session!.sdpOffer));

          // Process all pending candidates (local & pre-buffered by SocketContext)
          await processPendingIceCandidates();
          const preBuffered = getBufferedCandidates();
          for (const item of preBuffered) {
            if (item.candidate) {
              await addOrQueueCandidate(item.candidate);
            }
          }

          // Request any remaining candidates from server
          socket?.emit('call:get_buffered_candidates');

          const answer = await pc.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: wantsVideo,
          });

          const optimizedAnswerSdp = preferOpusAndFec(answer.sdp || '');
          const localAnswer = new RTCSessionDescription({ type: 'answer', sdp: optimizedAnswerSdp });
          await pc.setLocalDescription(localAnswer);

          // Wait brief moment for initial candidates
          await waitForIceGathering(pc, 400);

          if (socket) {
            socket.emit('call:accept', {
              callerId: session!.peerUser.id,
              sdpAnswer: pc.localDescription || localAnswer,
            });
          }
        }
      } catch (err: any) {
        console.error('WebRTC Initialization Error:', err);
        setErrorMessage(err?.message || 'Failed to initialize microphone or connection.');
      }
    }

    initWebRTC();

    // Socket signal listeners
    const handleAccepted = async (data: { receiverId: string; sdpAnswer: any }) => {
      soundEffects.stopOutgoingRing();
      setCallStatus('connecting');
      if (peerConnectionRef.current && data?.sdpAnswer) {
        try {
          if (peerConnectionRef.current.signalingState === 'have-local-offer') {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdpAnswer));
            await processPendingIceCandidates();

            // Process any candidates buffered while ringing
            const preBuffered = getBufferedCandidates();
            for (const item of preBuffered) {
              if (item.candidate) {
                await addOrQueueCandidate(item.candidate);
              }
            }

            socket?.emit('call:get_buffered_candidates');
          }
        } catch (setDescErr) {
          console.error('Error setting remote description on accepted call:', setDescErr);
        }
      }
    };

    const handleIceCandidate = async (data: { fromUserId: string; candidate: any }) => {
      if (data.candidate) {
        await addOrQueueCandidate(data.candidate);
      }
    };

    const handlePeerMediaState = (data: { fromUserId: string; trackType: 'audio' | 'video'; enabled: boolean }) => {
      if (data.trackType === 'audio') {
        setPeerMicMuted(!data.enabled);
        if (data.enabled) {
          remoteAudioRef.current?.play().catch(() => {});
        }
      } else if (data.trackType === 'video') {
        setPeerCameraOff(!data.enabled);
      }
    };

    const handlePeerScreenShare = (data: { fromUserId: string; isSharing: boolean }) => {
      setPeerScreenSharing(data.isSharing);
    };

    if (socket) {
      socket.on('call:accepted', handleAccepted);
      socket.on('call:peer_media_state_change', handlePeerMediaState);
      socket.on('call:peer_screen_share_toggle', handlePeerScreenShare);
    }

    // Subscribe to live ICE candidates forwarded from SocketContext
    const unsubscribeLiveCandidates = subscribeToIceCandidates((data) => {
      if (data.candidate) {
        addOrQueueCandidate(data.candidate);
      }
    });

    return () => {
      isCleanedUp = true;
      unsubscribeLiveCandidates();

      if (socket) {
        socket.off('call:accepted', handleAccepted);
        socket.off('call:peer_media_state_change', handlePeerMediaState);
        socket.off('call:peer_screen_share_toggle', handlePeerScreenShare);
      }

      // Stop local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (remoteAudioStreamRef.current) {
        remoteAudioStreamRef.current.getTracks().forEach(t => t.stop());
        remoteAudioStreamRef.current = new MediaStream();
      }
    };
  }, [session?.peerUser.id, session?.role, socket, addOrQueueCandidate, processPendingIceCandidates, getBufferedCandidates, subscribeToIceCandidates, unlockAudioContext]);

  // 5. Toggle Microphone
  const toggleMicrophone = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextState = !audioTracks[0].enabled;
        audioTracks.forEach(t => {
          t.enabled = nextState;
        });
        setIsMicMuted(!nextState);

        if (socket && session) {
          socket.emit('call:media_state_change', {
            targetUserId: session.peerUser.id,
            trackType: 'audio',
            enabled: nextState,
          });
        }
      }
    }
  }, [socket, session]);

  // 6. Toggle Camera
  const toggleCamera = useCallback(async () => {
    if (localStreamRef.current) {
      let videoTrack = localStreamRef.current.getVideoTracks()[0];

      if (videoTrack) {
        const nextState = !videoTrack.enabled;
        videoTrack.enabled = nextState;
        setIsCameraOff(!nextState);

        if (socket && session) {
          socket.emit('call:media_state_change', {
            targetUserId: session.peerUser.id,
            trackType: 'video',
            enabled: nextState,
          });
        }
      } else {
        // Was audio only, user now requests to enable video
        try {
          const newVideoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          });
          const newVideoTrack = newVideoStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(newVideoTrack);

          if (peerConnectionRef.current) {
            peerConnectionRef.current.addTrack(newVideoTrack, localStreamRef.current);
          }

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }

          setIsCameraOff(false);

          if (socket && session) {
            socket.emit('call:media_state_change', {
              targetUserId: session.peerUser.id,
              trackType: 'video',
              enabled: true,
            });
          }
        } catch (e) {
          console.warn('Could not turn on camera:', e);
        }
      }
    }
  }, [socket, session]);

  // 7. Toggle Screen Sharing
  const toggleScreenShare = useCallback(async () => {
    if (!peerConnectionRef.current || !session) return;

    if (isScreenSharing) {
      // Revert back to camera track
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }

      if (localStreamRef.current) {
        const camTrack = localStreamRef.current.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender && camTrack) {
          sender.replaceTrack(camTrack);
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      }

      setIsScreenSharing(false);
      if (socket) {
        socket.emit('call:screen_share_toggle', {
          targetUserId: session.peerUser.id,
          isSharing: false,
        });
      }
    } else {
      // Start screen share
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        const sender = peerConnectionRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenTrack.onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
        if (socket) {
          socket.emit('call:screen_share_toggle', {
            targetUserId: session.peerUser.id,
            isSharing: true,
          });
        }
      } catch (e) {
        console.warn('Screen share cancelled or failed:', e);
      }
    }
  }, [isScreenSharing, session, socket]);

  // Format duration into MM:SS
  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  return {
    callStatus,
    duration,
    formattedDuration: formatDuration(duration),
    isMicMuted,
    isCameraOff,
    isScreenSharing,
    peerMicMuted,
    peerCameraOff,
    peerScreenSharing,
    errorMessage,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    hangup: endActiveCall,
  };
}
