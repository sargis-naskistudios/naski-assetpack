import path from 'path';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

// NOTE: I am aware of the type errors. They can be ignored for now.
export function typeGenerator(options = {}) {
    const defaultOptions = {
        manifestPath: './public/assets/manifest.json',
        outputPath: './src/assets/assetManifest.ts',
    };

    const finalOptions = { ...defaultOptions, ...options };

    return {
        name: 'asset-type-generator',
        defaultOptions: finalOptions,
        async finish() {
            const absoluteManifestPath = path.resolve(finalOptions.manifestPath);

            try {
                const rawData = readFileSync(absoluteManifestPath, 'utf-8');
                const manifest = JSON.parse(rawData);

                let content = `/* AUTO-GENERATED - DO NOT EDIT */\n\nexport const assetManifest = {\n`;

                manifest.bundles.forEach((bundle: any) => {
                    if (!bundle.assets || bundle.assets.length === 0) return;

                    // Convert Bundle name to camelCase: "Fonts" or "spine-assets" -> "fonts", "spineAssets"
                    const bundleKey = bundle.name
                        .replace(/[-_](\w)/g, (_: string, c: string) => c.toUpperCase())
                        .replace(/^\w/, (c: string) => c.toLowerCase());

                    content += `  ${bundleKey}: {\n`;

                    bundle.assets.forEach((assetEntry: any) => {
                        const aliases = Array.isArray(assetEntry.alias) ? assetEntry.alias : [assetEntry.alias];

                        // Get the shortest alias
                        const shortestAlias = [...aliases].sort((a, b) => a.length - b.length)[0];

                        const fileName = shortestAlias.split('/').pop();
                        const ext = fileName.includes('.') ? fileName.split('.').pop() : '';
                        const baseName = fileName.replace(`.${ext}`, '');

                        // Convert Key to camelCase: "airplane-red" -> "airplaneRed"
                        let camelKey = baseName
                            .replace(/[-_](\w)/g, (_: string, c: string) => c.toUpperCase())
                            .replace(/^\w/, (c: string) => c.toLowerCase());

                        // --- VITAL PART: DEEP SCAN ATLASES ---
                        // If AssetPack tagged this as a TexturePacker (tps) file, we read its frames
                        const frames = assetEntry.data?.frameNames || assetEntry.data?.tags?.frameNames;

                        if (frames && Array.isArray(frames)) {
                            content += `    ${camelKey}: {\n`;
                            frames.forEach((frameName) => {
                                // Clean the frame name (loading_background -> loadingBackground)
                                const cleanFrame = frameName
                                    .replace(/\.[^/.]+$/, '') // remove extension
                                    .replace(/[-_](\w)/g, (_: string, c: string) => c.toUpperCase())
                                    .replace(/^\w/, (c: string) => c.toLowerCase());

                                content += `      ${cleanFrame}: "${frameName}",\n`;
                            });
                            content += `    },\n`;
                            return; // Move to next assetEntry
                        }

                        // --- END VITAL PART ---

                        // Append suffixes for conflicting types
                        if (ext.toLowerCase() === 'json') camelKey += 'Json';
                        else if (ext.toLowerCase() === 'atlas') camelKey += 'Atlas';
                        else if (ext.toLowerCase() === 'ttf') camelKey += 'Font';

                        content += `    ${camelKey}: "${shortestAlias}",\n`;
                    });
                    content += `  },\n`;
                });

                content += `} as const;\n\n`;
                content += `export type AssetBundleName = keyof typeof assetManifest;\n`;

                const dir = path.dirname(finalOptions.outputPath);

                mkdirSync(dir, { recursive: true });

                writeFileSync(finalOptions.outputPath, content);
                console.log(`✅ [AssetTypeGenerator] Generated strictly camelCase types: ${finalOptions.outputPath}`);
            } catch (e) {
                console.error('❌ [AssetTypeGenerator] Error:', (e as any).message);
            }
        },
    };
}
