import {MAX_IMAGE_MULTIPART_BYTES, type ImageUploadInput} from '../schemas/images';
import {createFileMultipart} from './fileMultipart';

export function createImageMultipart(input: ImageUploadInput, bytes: Buffer): {body: Buffer; boundary: string} {
    return createFileMultipart(input, bytes, MAX_IMAGE_MULTIPART_BYTES, 'Invalid Ghost image upload input.');
}
