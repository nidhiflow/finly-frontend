import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNativeApp } from './native';

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

export async function saveBlobFile({ blob, fileName, mimeType }) {
    if (!isNativeApp()) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
        return;
    }

    const dataUrl = await blobToDataUrl(blob);
    const base64 = String(dataUrl).split(',')[1] || '';
    const result = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
    });

    await Share.share({
        title: fileName,
        text: 'Exported from Finly',
        url: result.uri,
        dialogTitle: `Share ${fileName}`,
    });
}

export async function saveTextFile({ contents, fileName, mimeType = 'application/json' }) {
    if (!isNativeApp()) {
        const blob = new Blob([contents], { type: mimeType });
        await saveBlobFile({ blob, fileName, mimeType });
        return;
    }

    const result = await Filesystem.writeFile({
        path: fileName,
        data: contents,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
    });

    await Share.share({
        title: fileName,
        text: 'Exported from Finly',
        url: result.uri,
        dialogTitle: `Share ${fileName}`,
    });
}
