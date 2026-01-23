/**
 * CandidateProfileSection - Component for editing candidate profile
 * Used in SettingsDialog to allow users to input their resume and details
 */
import React, { useState } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

export interface CandidateProfile {
  name?: string;
  resume?: string;
  jobDescription?: string;
}

interface CandidateProfileSectionProps {
  profile: CandidateProfile;
  onProfileChange: (profile: CandidateProfile) => void;
}

export const CandidateProfileSection: React.FC<CandidateProfileSectionProps> = ({
  profile,
  onProfileChange,
}) => {
  const [localProfile, setLocalProfile] = useState<CandidateProfile>(profile);

  const handleFieldChange = (field: keyof CandidateProfile, value: string) => {
    const updated = { ...localProfile, [field]: value };
    setLocalProfile(updated);
    onProfileChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-white">Name (Optional)</label>
        <Input
          type="text"
          value={localProfile.name || ''}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          placeholder="Your name"
          className="bg-black/30 border-white/10 text-white placeholder:text-white/40"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white">Resume</label>
        <textarea
          value={localProfile.resume || ''}
          onChange={(e) => handleFieldChange('resume', e.target.value)}
          placeholder="Paste your full resume text here. This will help AI provide more personalized answer suggestions."
          rows={6}
          className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 resize-y"
        />
        <p className="text-xs text-white/60">
          Include your work experience, education, skills, and achievements. The more detail, the better the AI suggestions.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white">Job Description</label>
        <textarea
          value={localProfile.jobDescription || ''}
          onChange={(e) => handleFieldChange('jobDescription', e.target.value)}
          placeholder="Paste the target job description or role requirements."
          rows={4}
          className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-md text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 resize-y"
        />
        <p className="text-xs text-white/60">
          This is used to tailor suggestions to the target role.
        </p>
      </div>
    </div>
  );
};
