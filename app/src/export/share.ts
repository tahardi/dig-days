import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function shareExport(fileName: string, contents: string, uti: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(contents);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('sharing is not available on this device');
  }
  await Sharing.shareAsync(file.uri, { UTI: uti });
}
