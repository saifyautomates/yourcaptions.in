const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardLayout.tsx', 'utf8');

// Insert imports
const importsToInsert = `import { useCredits } from "@/hooks/useCredits";
import { usePlanInfo } from "@/hooks/usePlanInfo";
import { getPlanCapabilities, PLANS } from "@/lib/plans";
import { Progress } from "@/components/ui/progress";
`;

if (!code.includes("import { useCredits }")) {
  code = code.replace('import { ReactNode, useState } from "react";', `import { ReactNode, useState } from "react";\n${importsToInsert}`);
}

const navContentMatch = code.match(/const NavContent = \(\{\s*isAdmin,\s*user,\s*onSignOut,\s*onNavigate,\s*\}\: \{[\s\S]*?\}\) => \{/);

if (navContentMatch) {
  const replacement = `${navContentMatch[0]}
  const { planId, planName } = usePlanInfo();
  const { balance } = useCredits();
  const caps = getPlanCapabilities(planId);
`;
  if (!code.includes("const { planId, planName } = usePlanInfo();")) {
      code = code.replace(navContentMatch[0], replacement);
  }
}

// Add the usage card at the bottom of NavContent
const endOfNavContentRegex = /<\/nav>\s*<\/>\s*\);\s*\};/;
const usageCardHTML = `
        {!isAdmin && (
          <div className="mt-auto pt-8 pb-4">
            <div className="bg-[var(--bg-2)] border border-[var(--border-3)] rounded-xl p-4">
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-[13px] text-[var(--text-1)] uppercase tracking-wider">{planName}</span>
                <span className="text-[10px] font-semibold text-[var(--success)] bg-[var(--success)]/10 px-2 py-0.5 rounded-full uppercase">Monthly</span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="text-[var(--text-3)] font-medium">Storage</span>
                    <span className="text-[var(--text-4)]"><span className="text-[var(--success)]">0 GB</span> / 5.0 GB</span>
                  </div>
                  <div className="h-1.5 w-full bg-[var(--bg-5)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--success)]" style={{ width: '0%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="text-[var(--text-3)] font-medium">Transcription</span>
                    <span className="text-[var(--text-4)]"><span className="text-[var(--success)]">{Math.max(0, balance)} mins</span> left</span>
                  </div>
                  <div className="h-1.5 w-full bg-[var(--bg-5)] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[var(--success)]" 
                      style={{ width: \`\${Math.min(100, Math.max(0, (balance / caps.monthlyMinutes) * 100))}\%\` }} 
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="text-[var(--text-3)] font-medium">Audio Clean</span>
                    <span className="text-[var(--text-4)]"><span className="text-[var(--success)]">0</span> / 3</span>
                  </div>
                  <div className="h-1.5 w-full bg-[var(--bg-5)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--success)]" style={{ width: '0%' }} />
                  </div>
                </div>
              </div>
              
              <Link to="/pricing" onClick={onNavigate}>
                <button className="w-full mt-5 bg-[var(--success)] hover:bg-[var(--success)]/90 text-[var(--bg-1)] font-bold text-[12px] py-2 rounded-lg transition-colors">
                  Upgrade Now
                </button>
              </Link>
            </div>
          </div>
        )}
      </nav>
    </div>
  );
};`;

code = code.replace(/<\/nav>\s*<\/>\s*\);\s*\};/, usageCardHTML);
// Make NavContent wrap in flex-col h-full
code = code.replace(/<>\s*<div className="mb-6 px-2 pt-2">/, `<div className="flex flex-col h-full">\n      <div className="mb-6 px-2 pt-2">`);


fs.writeFileSync('src/components/DashboardLayout.tsx', code);
