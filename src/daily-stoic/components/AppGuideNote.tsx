import React from 'react';
import { GuideNote, GuideNoteProps } from '../../ds';
import { useShowGuides } from '../GuideContext';

export default function AppGuideNote(props: GuideNoteProps) {
  const showGuides = useShowGuides();
  return <GuideNote {...props} hidden={!showGuides} />;
}
