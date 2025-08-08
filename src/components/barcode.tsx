
"use client";
import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
interface BarcodeProps {
  value: string;
  options: JsBarcode.Options & { text?: string };
}
export function Barcode({ value, options }: BarcodeProps) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current) {
      JsBarcode(ref.current, value, options);
    }
  }, [value, options]);
  return <svg ref={ref} />;
};
