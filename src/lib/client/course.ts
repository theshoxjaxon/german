/** The language of the course being studied: its voices, greetings, labels and whether it has der/die/das. */
import { langOf, type LangInfo } from '../courses';
import { useStore } from './store';

export function useCourseLang(): LangInfo {
  return langOf(useStore().course);
}
