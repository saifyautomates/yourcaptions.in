/// <reference types="vite/client" />

declare module "*.asset.json" {
  const asset: {
    url: string;
    asset_id?: string;
    original_filename?: string;
    content_type?: string;
    size?: number;
  };
  export default asset;
}
