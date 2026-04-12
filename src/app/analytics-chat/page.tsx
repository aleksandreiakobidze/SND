import { redirect } from "next/navigation";

/** Analytics coach merged into /agent — keep old URL working */
export default function AnalyticsChatRedirectPage() {
  redirect("/agent?mode=ask");
}
