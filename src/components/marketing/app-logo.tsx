import Image from "next/image";
import appIcon from "@/app/icon.png";

/**
 * The app icon (the same file as the favicon, src/app/icon.png), used as the
 * logo in the marketing header, mobile menu and footer. Decorative: the
 * "DevskStudio" wordmark always sits next to it.
 */
export function AppLogo({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <Image
      src={appIcon}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, flex: "none" }}
    />
  );
}
