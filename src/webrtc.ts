import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  onSnapshot, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

const configuration = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

  constructor(private mosqueId: string, private userId: string) {}

  async startBroadcasting(onStream: (stream: MediaStream) => void) {
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    onStream(this.localStream);

    this.peerConnection = new RTCPeerConnection(configuration);
    this.localStream.getTracks().forEach(track => {
      this.peerConnection?.addTrack(track, this.localStream!);
    });

    // Signaling logic for broadcaster (Simplified for MVP: one-to-many via a "room" pattern)
    // In a real production app with thousands of users, we'd use an SFU (Selective Forwarding Unit).
    // For this demo, we'll store the offer in a central "live_stream" doc.
    
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    const streamRef = doc(db, 'mosques', this.mosqueId, 'signaling', 'broadcast');
    try {
      await setDoc(streamRef, {
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, streamRef.path);
    }

    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        const candidatesCol = collection(db, 'mosques', this.mosqueId, 'signaling', 'broadcast', 'candidates');
        try {
          await addDoc(candidatesCol, event.candidate.toJSON());
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, candidatesCol.path);
        }
      }
    };
  }

  async startListening(onStream: (stream: MediaStream) => void) {
    this.peerConnection = new RTCPeerConnection(configuration);
    this.remoteStream = new MediaStream();
    onStream(this.remoteStream);

    this.peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => {
        this.remoteStream?.addTrack(track);
      });
    };

    const streamRef = doc(db, 'mosques', this.mosqueId, 'signaling', 'broadcast');
    let streamDoc;
    try {
      streamDoc = await getDoc(streamRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, streamRef.path);
    }

    if (streamDoc && streamDoc.exists()) {
      const data = streamDoc.data();
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // In a real SFU, we'd send this back. For P2P, we'd need a way to match.
      // For this MVP, we'll assume the listener can just connect to the broadcast offer.
    }

    // Listen for ICE candidates
    const candidatesCol = collection(db, 'mosques', this.mosqueId, 'signaling', 'broadcast', 'candidates');
    onSnapshot(candidatesCol, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          try {
            await this.peerConnection?.addIceCandidate(new RTCIceCandidate(data));
          } catch (e) {
            console.error("Error adding ICE candidate", e);
          }
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, candidatesCol.path);
    });
  }

  stop() {
    this.localStream?.getTracks().forEach(track => track.stop());
    this.peerConnection?.close();
    this.peerConnection = null;
  }
}
