import Keylane from "./keylane";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ room?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <Keylane
      initialRoom={
        typeof params.room === "string" ? params.room.slice(0, 6) : ""
      }
    />
  );
}
