"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReloadButton() {
  return (
    <Button onClick={() => window.location.reload()}>
      <RotateCcw />
      Réessayer
    </Button>
  );
}
