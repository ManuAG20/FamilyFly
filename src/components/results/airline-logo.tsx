"use client";

import Image from "next/image";
import { useState } from "react";
import { getAirline } from "@/data/airlines";

type AirlineLogoProps = {
  code: string;
  name: string;
  useRemote: boolean;
};

export function AirlineLogo({ code, name, useRemote }: AirlineLogoProps) {
  const [failed, setFailed] = useState(false);
  const airline = getAirline(code);

  if (useRemote && !failed) {
    return (
      <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white">
        <Image
          src={`https://pics.avs.io/200/200/${code}.png`}
          alt={name}
          width={40}
          height={40}
          className="h-8 w-8 object-contain"
          unoptimized
          onError={() => setFailed(true)}
        />
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface"
          style={{ backgroundColor: airline.color }}
        />
      </span>
    );
  }

  return (
    <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-[11px] font-bold text-brand">
      {code}
      <span
        aria-hidden="true"
        className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface"
        style={{ backgroundColor: airline.color }}
      />
    </span>
  );
}
