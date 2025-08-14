import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, X, HelpCircle } from "lucide-react";

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  confirmValue?: string;
  onConfirmChange?: (value: string) => void;
  showConfirm?: boolean;
  className?: string;
  required?: boolean;
}

interface PasswordRequirement {
  text: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  { text: "At least 8 characters", test: (p) => p.length >= 8 },
  { text: "Must include both letters and numbers", test: (p) => /[a-zA-Z]/.test(p) && /[0-9]/.test(p) },
  { text: "Must have at least one uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { text: "Must have at least one number", test: (p) => /[0-9]/.test(p) },
];

export const PasswordInput: React.FC<PasswordInputProps> = ({
  id,
  label,
  value,
  onChange,
  confirmValue,
  onConfirmChange,
  showConfirm = false,
  className,
  required = false,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const getPasswordStrength = () => {
    const passedRequirements = passwordRequirements.filter(req => req.test(value)).length;
    return passedRequirements;
  };

  const isPasswordValid = () => {
    return getPasswordStrength() === passwordRequirements.length;
  };

  const doPasswordsMatch = () => {
    return showConfirm && confirmValue !== undefined && value === confirmValue && value.length > 0;
  };

  const passwordsDoNotMatch = () => {
    return showConfirm && confirmValue !== undefined && value !== confirmValue && confirmValue.length > 0;
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>
          {label} {required && "*"}
        </Label>
        <TooltipProvider>
          <Tooltip open={showTooltip} onOpenChange={setShowTooltip}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onFocus={() => setShowTooltip(true)}
                onBlur={() => setShowTooltip(false)}
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="w-80">
              <div className="space-y-2">
                <p className="font-medium">Password Requirements:</p>
                <ul className="space-y-1">
                  {passwordRequirements.map((req, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      {req.test(value) ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <X className="h-3 w-3 text-red-500" />
                      )}
                      <span className={req.test(value) ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
                        {req.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <div className="relative">
        <Input
          id={id}
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            value.length > 0 && (isPasswordValid() ? "border-green-500" : "border-red-500")
          )}
          autoComplete="new-password"
          required={required}
        />
        {value.length > 0 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isPasswordValid() ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <X className="h-4 w-4 text-red-500" />
            )}
          </div>
        )}
      </div>
      
      {showConfirm && onConfirmChange && (
        <>
          <Label htmlFor={`${id}-confirm`}>
            Confirm Password {required && "*"}
          </Label>
          <div className="relative">
            <Input
              id={`${id}-confirm`}
              type="password"
              value={confirmValue || ""}
              onChange={(e) => onConfirmChange(e.target.value)}
              className={cn(
                confirmValue && confirmValue.length > 0 && (
                  doPasswordsMatch() ? "border-green-500" : "border-red-500"
                )
              )}
              autoComplete="new-password"
              required={required}
            />
            {confirmValue && confirmValue.length > 0 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {doPasswordsMatch() ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <X className="h-4 w-4 text-red-500" />
                )}
              </div>
            )}
          </div>
          {passwordsDoNotMatch() && (
            <p className="text-sm text-red-600 dark:text-red-400">
              Passwords do not match
            </p>
          )}
        </>
      )}
      
      {value.length > 0 && !isPasswordValid() && (
        <div className="text-sm space-y-1">
          <p className="text-muted-foreground">Password strength:</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-2 w-full rounded-full",
                  i <= getPasswordStrength()
                    ? getPasswordStrength() <= 2
                      ? "bg-red-500"
                      : getPasswordStrength() === 3
                      ? "bg-yellow-500"
                      : "bg-green-500"
                    : "bg-muted"
                )}
              />
            ))}
          </div>
          <p className={cn(
            "text-xs",
            getPasswordStrength() <= 2 ? "text-red-600 dark:text-red-400" :
            getPasswordStrength() === 3 ? "text-yellow-600 dark:text-yellow-400" :
            "text-green-600 dark:text-green-400"
          )}>
            {getPasswordStrength() <= 2 ? "Weak" :
             getPasswordStrength() === 3 ? "Good" : "Strong"}
          </p>
        </div>
      )}
    </div>
  );
};