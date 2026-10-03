"use client";

import { useParams } from "next/navigation";
import { EditorPage } from "@/editor/EditorPage";

export default function EditRoute() {
  const params = useParams<{ id: string }>();
  return <EditorPage projectId={params.id} />;
}
