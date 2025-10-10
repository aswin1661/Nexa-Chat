import 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    name: string;
    email: string;
    username: string;
  }

  interface Session {
    user: User & {
      id: string;
      name: string;
      email: string;
      username: string;
    };
  }
}