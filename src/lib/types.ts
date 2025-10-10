export interface Message {
  id: string;
  content: string;
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  read: boolean;
  sender: {
    id: string;
    name: string;
    username: string;
    email: string;
  };
  receiver: {
    id: string;
    name: string;
    username: string;
    email: string;
  };
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  username: string;
}