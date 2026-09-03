import { Request, Response } from 'express';
import { getIceServers } from '../services/webrtc.js';

export async function getWebRtcConfig(req: Request, res: Response): Promise<void> {
  const iceServers = getIceServers();
  res.json({
    iceServers,
    sdpSemantics: 'unified-plan',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  });
}
