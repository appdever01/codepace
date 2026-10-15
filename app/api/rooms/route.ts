import { createRoom, handleApi } from "@/lib/rooms-server";
export async function POST(request: Request) {
  return handleApi(() => createRoom(request));
}
