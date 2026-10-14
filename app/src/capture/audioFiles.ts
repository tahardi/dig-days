import { Directory, File, Paths } from 'expo-file-system';

export function persistClip(tempUri: string, workDayId: number): string {
  const clips = new Directory(Paths.document, 'clips');
  clips.create({ intermediates: true, idempotent: true });
  const destination = new File(clips, `work-day-${workDayId}.m4a`);
  new File(tempUri).copySync(destination, { overwrite: true });
  return destination.uri;
}
