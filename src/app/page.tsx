"use client";

import { useRouter } from "next/navigation";
import { ProjectsHome } from "@/editor/ProjectsHome";

export default function HomePage() {
  const router = useRouter();
  return <ProjectsHome navigate={(href) => router.push(href)} />;
}
