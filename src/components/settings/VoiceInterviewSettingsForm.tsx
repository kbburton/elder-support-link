import { useState, useEffect } from 'react';
import { useVoiceConfig } from '@/hooks/useVoiceConfig';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  groupId: string;
}

export function VoiceInterviewSettingsForm({ groupId }: Props) {
  const { config, isLoading, updateConfig, resetToDefaults, isUpdating, isResetting } = useVoiceConfig(groupId);
  
  const [formData, setFormData] = useState({
    vad_threshold: 0.5,
    vad_silence_duration_ms: 2500,
    vad_prefix_padding_ms: 500,
    temperature: 0.7,
    response_style_instructions: 'Keep your responses brief - maximum 1-2 sentences. Ask one focused follow-up question at a time. Wait patiently for the person to finish their thoughts.'
  });

  useEffect(() => {
    if (config) {
      setFormData({
        vad_threshold: config.vad_threshold,
        vad_silence_duration_ms: config.vad_silence_duration_ms,
        vad_prefix_padding_ms: config.vad_prefix_padding_ms,
        temperature: config.temperature,
        response_style_instructions: config.response_style_instructions
      });
    }
  }, [config]);

  const handleSave = () => {
    updateConfig(formData);
  };

  const handleReset = () => {
    resetToDefaults();
  };

  const isDefault = (field: keyof typeof formData, value: number | string) => {
    const defaults: Record<string, number> = {
      vad_threshold: 0.5,
      vad_silence_duration_ms: 2500,
      vad_prefix_padding_ms: 500,
      temperature: 0.7
    };
    return defaults[field] === value;
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* VAD Threshold */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">
            Voice Detection Sensitivity
            {!isDefault('vad_threshold', formData.vad_threshold) && (
              <AlertCircle className="inline-block ml-2 h-4 w-4 text-amber-500" />
            )}
          </Label>
          <span className="text-sm font-mono text-muted-foreground">{formData.vad_threshold.toFixed(2)}</span>
        </div>
        <Slider
          value={[formData.vad_threshold]}
          onValueChange={([value]) => setFormData({ ...formData, vad_threshold: value })}
          min={0}
          max={1}
          step={0.05}
          className="w-full"
        />
        <p className="text-sm text-muted-foreground">
          How sensitive the AI is to detecting speech. <strong>LOWER</strong> = more sensitive (picks up quieter speech, may interrupt more). <strong>HIGHER</strong> = less sensitive (requires louder/clearer speech, may miss quiet responses). <strong>Default: 0.5</strong>
        </p>
      </div>

      {/* Silence Duration */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">
            Wait Time Before Responding
            {(!isDefault('vad_silence_duration_ms', formData.vad_silence_duration_ms) || formData.vad_silence_duration_ms < 1500) && (
              <AlertCircle className="inline-block ml-2 h-4 w-4 text-amber-500" />
            )}
          </Label>
          <span className="text-sm font-mono text-muted-foreground">{formData.vad_silence_duration_ms}ms ({(formData.vad_silence_duration_ms / 1000).toFixed(1)}s)</span>
        </div>
        <Slider
          value={[formData.vad_silence_duration_ms]}
          onValueChange={([value]) => setFormData({ ...formData, vad_silence_duration_ms: value })}
          min={500}
          max={10000}
          step={250}
          className="w-full"
        />
        <p className="text-sm text-muted-foreground">
          How long the AI waits after the person stops speaking before it responds. <strong>SHORTER</strong> = AI jumps in faster (may interrupt storytelling). <strong>LONGER</strong> = AI waits more patiently (better for elderly or those who speak slowly). <strong>Default: 2500ms (2.5 seconds)</strong>
          {formData.vad_silence_duration_ms < 1500 && (
            <span className="block mt-1 text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ Warning: Values under 1500ms may cause frequent interruptions
            </span>
          )}
        </p>
      </div>

      {/* Prefix Padding */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">
            Audio Buffer Time
            {(!isDefault('vad_prefix_padding_ms', formData.vad_prefix_padding_ms) || formData.vad_prefix_padding_ms < 300) && (
              <AlertCircle className="inline-block ml-2 h-4 w-4 text-amber-500" />
            )}
          </Label>
          <span className="text-sm font-mono text-muted-foreground">{formData.vad_prefix_padding_ms}ms</span>
        </div>
        <Slider
          value={[formData.vad_prefix_padding_ms]}
          onValueChange={([value]) => setFormData({ ...formData, vad_prefix_padding_ms: value })}
          min={100}
          max={2000}
          step={50}
          className="w-full"
        />
        <p className="text-sm text-muted-foreground">
          Extra audio captured before speech detection. <strong>LONGER</strong> = catches more of the first word (better for soft-spoken individuals). <strong>SHORTER</strong> = faster response but may cut off beginning of speech. <strong>Default: 500ms</strong>
          {formData.vad_prefix_padding_ms < 300 && (
            <span className="block mt-1 text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ Warning: Values under 300ms may cut off the beginning of speech
            </span>
          )}
        </p>
      </div>

      {/* Temperature */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">
            AI Creativity Level
            {(!isDefault('temperature', formData.temperature) || formData.temperature > 0.8) && (
              <AlertCircle className="inline-block ml-2 h-4 w-4 text-amber-500" />
            )}
          </Label>
          <span className="text-sm font-mono text-muted-foreground">{formData.temperature.toFixed(1)}</span>
        </div>
        <Slider
          value={[formData.temperature]}
          onValueChange={([value]) => setFormData({ ...formData, temperature: value })}
          min={0}
          max={1}
          step={0.1}
          className="w-full"
        />
        <p className="text-sm text-muted-foreground">
          Controls how creative vs. consistent the AI's responses are. <strong>LOWER</strong> = more focused, predictable, and concise. <strong>HIGHER</strong> = more varied and conversational. <strong>Default: 0.7</strong>
          {formData.temperature > 0.8 && (
            <span className="block mt-1 text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ Warning: High creativity may lead to less predictable responses
            </span>
          )}
        </p>
      </div>

      {/* Response Style Instructions */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          Custom AI Instructions
        </Label>
        <Textarea
          value={formData.response_style_instructions}
          onChange={(e) => setFormData({ ...formData, response_style_instructions: e.target.value })}
          rows={4}
          maxLength={500}
          placeholder="Keep your responses brief - maximum 1-2 sentences. Ask one focused follow-up question at a time. Wait patiently for the person to finish their thoughts."
          className="font-mono text-sm"
        />
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Additional instructions for how the AI should behave during interviews. These are added to the base interview prompt. Be specific and concise.
          </p>
          <span className="text-xs text-muted-foreground">
            {formData.response_style_instructions.length}/500
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={isResetting || isUpdating}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          {isResetting ? 'Resetting...' : 'Reset to Defaults'}
        </Button>
        <Button
          onClick={handleSave}
          disabled={isUpdating || isResetting}
        >
          {isUpdating ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
