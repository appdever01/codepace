import { handleApi, readRoom, updateRoom } from "@/lib/rooms-server";
type Context = { params: Promise<{ code: string }> };
export async function GET(request: Request, context: Context) {
  const { code } = await context.params;
  return handleApi(() => readRoom(request, code.toUpperCase()));
}
export async function POST(request: Request, context: Context) {
  const { code } = await context.params;
  return handleApi(() => updateRoom(request, code.toUpperCase()));
}
