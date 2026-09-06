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
    { urls: 'stun:global.stun.twilio.com:3478' },
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
};

export function useWebRTC(session: ActiveCallSession | null) {
  const { socket, endActiveCall } = useSocket();
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
  }, [remoteStream, remoteVideoRef.current, peerCameraOff]);

  // 4. Initialize WebRTC connection
  useEffect(() => {
    if (!session || !socket || !user) return;

    let isCleanedUp = false;
    pendingIceCandidatesRef.current = [];

    async function initWebRTC() {
      try {
        const wantsVideo = session!.callType === 'video';

        // Acquire media devices with high-fidelity crystal clear audio settings
        let stream: MediaStream;
        const audioConstraints: MediaTrackConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        };

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: wantsVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
          });
        } catch (mediaErr) {
          console.warn('Media devices error, fallback to audio only:', mediaErr);
          stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
          setIsCameraOff(true);
        }

        if (isCleanedUp) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

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
              bundlePolicy: configRes.bundlePolicy || 'max-bundle',
            };
          }
        } catch (e) {
          console.warn('Using default STUN fallback:', e);
        }

        // Create PeerConnection with STUN/TURN
        const pc = new RTCPeerConnection(rtcConfig);
        peerConnectionRef.current = pc;

        // Add local tracks to PeerConnection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Remote track handler
        pc.ontrack = (event) => {
          console.log('WebRTC ontrack event:', event.track.kind, event.streams);
          let streamToSet: MediaStream;
          if (event.streams && event.streams[0]) {
            streamToSet = event.streams[0];
          } else {
            streamToSet = new MediaStream([event.track]);
          }

          setRemoteStream(streamToSet);

          if (event.track.kind === 'video') {
            setPeerCameraOff(false);
          }

          event.track.onunmute = () => {
            if (event.track.kind === 'video') setPeerCameraOff(false);
            if (event.track.kind === 'audio') setPeerMicMuted(false);
          };
          event.track.onmute = () => {
            if (event.track.kind === 'video') setPeerCameraOff(true);
            if (event.track.kind === 'audio') setPeerMicMuted(true);
          };
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
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            setCallStatus('ended');
          }
        };

        // If caller: create offer
        if (session!.role === 'caller') {
          setCallStatus('ringing');
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          if (socket) {
            socket.emit('call:initiate', {
              receiverId: session!.peerUser.id,
              callType: session!.callType,
              sdpOffer: offer,
            });
          }
        }
        // If receiver: handle existing offer & create answer
        else if (session!.role === 'receiver' && session!.sdpOffer) {
          setCallStatus('connecting');
          await pc.setRemoteDescription(new RTCSessionDescription(session!.sdpOffer));
          await processPendingIceCandidates();

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          if (socket) {
            socket.emit('call:accept', {
              callerId: session!.peerUser.id,
              sdpAnswer: answer,
            });
          }
        }
      } catch (err: any) {
        console.error('WebRTC Initialization Error:', err);
        setErrorMessage(err?.message || 'Failed to initialize camera/microphone.');
      }
    }

    initWebRTC();

    // Socket signal listeners
    const handleAccepted = async (data: { receiverId: string; sdpAnswer: any }) => {
      soundEffects.stopOutgoingRing();
      setCallStatus('connecting');
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdpAnswer));
        await processPendingIceCandidates();
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
      } else if (data.trackType === 'video') {
        setPeerCameraOff(!data.enabled);
      }
    };

    const handlePeerScreenShare = (data: { fromUserId: string; isSharing: boolean }) => {
      setPeerScreenSharing(data.isSharing);
    };

    if (socket) {
      socket.on('call:accepted', handleAccepted);
      socket.on('call:ice_candidate', handleIceCandidate);
      socket.on('call:peer_media_state_change', handlePeerMediaState);
      socket.on('call:peer_screen_share_toggle', handlePeerScreenShare);
    }

    return () => {
      isCleanedUp = true;
      if (socket) {
        socket.off('call:accepted', handleAccepted);
        socket.off('call:ice_candidate', handleIceCandidate);
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
    };
  }, [session?.peerUser.id, session?.role, socket, addOrQueueCandidate, processPendingIceCandidates]);

  // 5. Toggle Microphone
  const toggleMicrophone = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const nextState = !audioTrack.enabled;
        audioTrack.enabled = nextState;
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
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    hangup: endActiveCall,
  };
}
