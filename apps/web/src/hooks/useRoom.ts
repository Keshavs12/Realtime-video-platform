import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

interface Peer {
  socketId: string;
  userId: string;
  name?: string;
  stream: MediaStream;
}

interface PresenceUser {
  socketId: string;
  userId: string;
  name?: string;
}

/**
 * Custom React hook for WebRTC multi-peer video rooms and signaling.
 * Handles local media stream, Socket.IO connections, WebRTC peer connections, and presence list.
 */
export const useRoom = (roomId: string, user: { id: string; name: string; email: string } | null) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [presenceList, setPresenceList] = useState<PresenceUser[]>([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionsRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!user) return;

    // 1. Fetch Local Stream
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setLocalStream(stream);
        localStreamRef.current = stream;

        // 2. Connect to Socket Server
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";
        const socket = io(socketUrl, {
          transports: ["websocket"],
        });
        socketRef.current = socket;

        // Join room once connected
        socket.on("connect", () => {
          socket.emit("join-room", {
            roomId,
            userId: user.id,
            name: user.name,
          });
        });

        // 3. Handle Room users & Presence
        socket.on("room-users", async ({ users }: { users: PresenceUser[] }) => {
          // Set initial list of other users in the room
          setPresenceList(users);

          // The newly joined user initiates the peer connection with all existing users
          for (const existingUser of users) {
            await initiateCall(existingUser.socketId, existingUser.userId, existingUser.name, stream);
          }
        });

        socket.on("user-joined", ({ socketId, userId, name }: PresenceUser) => {
          // Add to presence list
          setPresenceList((prev) => {
            const exists = prev.some((p) => p.socketId === socketId);
            if (exists) return prev;
            return [...prev, { socketId, userId, name }];
          });
        });

        socket.on("user-left", ({ socketId }: { socketId: string }) => {
          // Remove from presence list
          setPresenceList((prev) => prev.filter((p) => p.socketId !== socketId));
          // Remove peer connection and stream
          closePeerConnection(socketId);
        });

        // 4. WebRTC Signaling Listeners
        socket.on("offer", async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
          const peerConnection = createPeerConnection(from, stream);
          await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
          
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          socket.emit("answer", { to: from, answer });
        });

        socket.on("answer", async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
          const peerConnection = peerConnectionsRef.current[from];
          if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
          }
        });

        socket.on("ice-candidate", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
          const peerConnection = peerConnectionsRef.current[from];
          if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          }
        });
      })
      .catch((err) => {
        console.error("Accessing media devices failed:", err);
      });

    // Cleanup on unmount
    return () => {
      // Stop all tracks on local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Close all peer connections
      Object.keys(peerConnectionsRef.current).forEach((socketId) => {
        closePeerConnection(socketId);
      });

      // Leave socket room and disconnect
      if (socketRef.current) {
        socketRef.current.emit("leave-room");
        socketRef.current.disconnect();
      }
    };
  }, [roomId, user]);

  // Initiate an RTC connection with an existing peer (from the room-users list)
  const initiateCall = async (targetSocketId: string, targetUserId: string, targetName: string | undefined, stream: MediaStream) => {
    const peerConnection = createPeerConnection(targetSocketId, stream, targetUserId, targetName);
    
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socketRef.current?.emit("offer", {
      to: targetSocketId,
      offer,
    });
  };

  // Helper to create and configure an RTCPeerConnection
  const createPeerConnection = (
    peerSocketId: string, 
    stream: MediaStream, 
    peerUserId?: string, 
    peerName?: string
  ): RTCPeerConnection => {
    // If connection already exists, return it
    if (peerConnectionsRef.current[peerSocketId]) {
      return peerConnectionsRef.current[peerSocketId];
    }

    const peerConnection = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current[peerSocketId] = peerConnection;

    // Add local tracks to the connection
    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
    });

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("ice-candidate", {
          to: peerSocketId,
          candidate: event.candidate,
        });
      }
    };

    // When remote track is received
    peerConnection.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setPeers((prev) => {
        // Prevent duplicate peer entries
        const exists = prev.some((p) => p.socketId === peerSocketId);
        if (exists) return prev;

        return [
          ...prev,
          {
            socketId: peerSocketId,
            userId: peerUserId || "",
            name: peerName,
            stream: remoteStream,
          },
        ];
      });
    };

    return peerConnection;
  };

  // Helper to close a specific Peer Connection
  const closePeerConnection = (socketId: string) => {
    const peerConnection = peerConnectionsRef.current[socketId];
    if (peerConnection) {
      peerConnection.close();
      delete peerConnectionsRef.current[socketId];
    }
    setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
  };

  // Control Buttons logic
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  };

  return {
    localStream,
    peers,
    presenceList,
    toggleAudio,
    toggleVideo,
    isAudioMuted,
    isVideoMuted,
  };
};
