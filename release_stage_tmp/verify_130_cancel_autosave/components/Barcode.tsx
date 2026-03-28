import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeProps {
  value: string | number | null | undefined;
  className?: string;
  displayValue?: boolean;
  height?: number;
  width?: number;
}

const Barcode: React.FC<BarcodeProps> = ({ value, className = '', displayValue = false, height = 48, width = 2 }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      (JsBarcode as any)(svgRef.current, String(value ?? ''), {
        format: 'CODE128',
        displayValue: displayValue,
        height: height,
        width: width,
        margin: 0
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Barcode generation failed', e);
    }
  }, [value, displayValue, height, width]);

  return <svg ref={svgRef} className={className} />;
};

export default Barcode;
