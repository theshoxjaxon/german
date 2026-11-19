/**
 * The language of the course being studied: its voices, greetings, labels and whether it has
 * der/die/das. The app provides it once (KarteikastenApp), so the many places that need it, every
 * word in a list included, don't each listen to the whole store.
 */
import { createContext, useContext } from 'react';
import { LANGS, type LangInfo } from '../courses';

export const CourseLangContext = createContext<LangInfo>(LANGS.de);

export const useCourseLang = (): LangInfo => useContext(CourseLangContext);
