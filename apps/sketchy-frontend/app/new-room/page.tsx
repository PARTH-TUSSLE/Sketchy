import { NewRoom } from "../components/NewRoom";

export const metadata = {
  title: "New room — Sketchy",
  description:
    "Name a room and open a shared canvas. Everyone who knows the name can draw there, live.",
};

export default function NewRoomPage() {
  return <NewRoom />;
}