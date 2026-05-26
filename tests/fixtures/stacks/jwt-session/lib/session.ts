import { cookies } from "next/headers";
export function setSession() {
  cookies().set("sid", "x");
}
