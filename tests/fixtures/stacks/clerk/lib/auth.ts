import { auth } from "@clerk/nextjs/server";
export function getUser() {
  return auth();
}
