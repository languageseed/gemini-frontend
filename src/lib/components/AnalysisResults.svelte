<script lang="ts">
	import { 
		Download, Filter, CheckCircle, XCircle, AlertCircle,
		Bug, Shield, Zap, Clock, FileCode, ChevronDown
	} from 'lucide-svelte';
	import IssueCard from './IssueCard.svelte';

	export let result: {
		repo_url: string;
		focus: string;
		issues: any[];
		summary: string;
		files_analyzed: number;
		total_issues: number;
		verified_count: number;
		unverified_count: number;
		analysis_time_seconds: number;
		verification_time_seconds: number;
	};

	let filter: 'all' | 'critical' | 'security' | 'verified' = 'all';
	let showFilters = false;

	$: filteredIssues = result.issues.filter(issue => {
		if (filter === 'all') return true;
		if (filter === 'critical') return issue.severity === 'critical' || issue.severity === 'high';
		if (filter === 'security') return issue.category === 'security';
		if (filter === 'verified') return issue.verification_status === 'verified';
		return true;
	});

	$: severityCounts = {
		critical: result.issues.filter(i => i.severity === 'critical').length,
		high: result.issues.filter(i => i.severity === 'high').length,
		medium: result.issues.filter(i => i.severity === 'medium').length,
		low: result.issues.filter(i => i.severity === 'low').length,
	};

	function exportToMarkdown() {
		const date = new Date().toISOString().split('T')[0];
		
		let md = `# Codebase Analysis Report

**Repository:** ${result.repo_url}
**Date:** ${date}
**Focus:** ${result.focus}
**Analysis Time:** ${result.analysis_time_seconds.toFixed(1)}s
**Verification Time:** ${result.verification_time_seconds.toFixed(1)}s

## Summary

- **${result.total_issues} issues found**
- **${result.verified_count} verified** (confirmed via automated tests)
- **${result.unverified_count} unverified** (may be false positives)
- **${result.files_analyzed} files analyzed**

### By Severity

| Severity | Count |
|----------|-------|
| 🔴 Critical | ${severityCounts.critical} |
| 🟠 High | ${severityCounts.high} |
| 🟡 Medium | ${severityCounts.medium} |
| ⚪ Low | ${severityCounts.low} |

---

## Issues

`;

		// Sort by severity
		const sorted = [...result.issues].sort((a, b) => {
			const order = { critical: 0, high: 1, medium: 2, low: 3 };
			return (order[a.severity as keyof typeof order] || 3) - (order[b.severity as keyof typeof order] || 3);
		});

		for (const issue of sorted) {
			const statusIcon = issue.verification_status === 'verified' ? '✓ VERIFIED' : 
				issue.verification_status === 'unverified' ? '? UNVERIFIED' : '';
			
			md += `### ${issue.title} ${statusIcon}

**Severity:** ${issue.severity.toUpperCase()}
**Category:** ${issue.category}
**File:** \`${issue.file_path}${issue.line_number ? ':' + issue.line_number : ''}\`

${issue.description}

`;

			if (issue.code_snippet) {
				md += `**Problematic Code:**
\`\`\`
${issue.code_snippet}
\`\`\`

`;
			}

			if (issue.recommendation) {
				md += `**Recommendation:** ${issue.recommendation}

`;
			}

			if (issue.recommended_code) {
				md += `**Suggested Fix:**
\`\`\`
${issue.recommended_code}
\`\`\`

`;
			}

			if (issue.test_code && issue.verification_status !== 'skipped') {
				md += `**Verification Test:**
\`\`\`python
${issue.test_code}
\`\`\`

`;
			}

			md += `---

`;
		}

		// Download
		const blob = new Blob([md], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `analysis-${result.repo_url.split('/').pop()}-${date}.md`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h3 class="text-lg font-semibold">Analysis Results</h3>
		<button
			type="button"
			on:click={exportToMarkdown}
			class="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm hover:bg-secondary/80"
		>
			<Download class="h-4 w-4" />
			Export
		</button>
	</div>

	<!-- Summary Cards -->
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
		<div class="rounded-lg bg-secondary/50 p-3">
			<div class="text-2xl font-bold">{result.total_issues}</div>
			<div class="text-xs text-muted-foreground">Issues Found</div>
		</div>
		<div class="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
			<div class="text-2xl font-bold text-green-400">{result.verified_count}</div>
			<div class="text-xs text-muted-foreground">Verified</div>
		</div>
		<div class="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
			<div class="text-2xl font-bold text-yellow-400">{result.unverified_count}</div>
			<div class="text-xs text-muted-foreground">Unverified</div>
		</div>
		<div class="rounded-lg bg-secondary/50 p-3">
			<div class="text-2xl font-bold">{result.files_analyzed}</div>
			<div class="text-xs text-muted-foreground">Files Analyzed</div>
		</div>
	</div>

	<!-- Severity Breakdown -->
	<div class="flex items-center gap-4 text-sm">
		<span class="text-muted-foreground">By Severity:</span>
		<div class="flex items-center gap-1">
			<span class="h-2 w-2 rounded-full bg-red-500"></span>
			<span>{severityCounts.critical}</span>
		</div>
		<div class="flex items-center gap-1">
			<span class="h-2 w-2 rounded-full bg-orange-500"></span>
			<span>{severityCounts.high}</span>
		</div>
		<div class="flex items-center gap-1">
			<span class="h-2 w-2 rounded-full bg-yellow-500"></span>
			<span>{severityCounts.medium}</span>
		</div>
		<div class="flex items-center gap-1">
			<span class="h-2 w-2 rounded-full bg-gray-500"></span>
			<span>{severityCounts.low}</span>
		</div>
	</div>

	<!-- Filter Tabs -->
	<div class="flex flex-wrap gap-2">
		<button
			type="button"
			on:click={() => filter = 'all'}
			class="rounded-full px-3 py-1 text-sm transition-colors {filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'}"
		>
			All ({result.issues.length})
		</button>
		<button
			type="button"
			on:click={() => filter = 'critical'}
			class="rounded-full px-3 py-1 text-sm transition-colors {filter === 'critical' ? 'bg-red-500 text-white' : 'bg-secondary hover:bg-secondary/80'}"
		>
			Critical/High ({severityCounts.critical + severityCounts.high})
		</button>
		<button
			type="button"
			on:click={() => filter = 'security'}
			class="rounded-full px-3 py-1 text-sm transition-colors flex items-center gap-1 {filter === 'security' ? 'bg-purple-500 text-white' : 'bg-secondary hover:bg-secondary/80'}"
		>
			<Shield class="h-3 w-3" />
			Security
		</button>
		<button
			type="button"
			on:click={() => filter = 'verified'}
			class="rounded-full px-3 py-1 text-sm transition-colors flex items-center gap-1 {filter === 'verified' ? 'bg-green-500 text-white' : 'bg-secondary hover:bg-secondary/80'}"
		>
			<CheckCircle class="h-3 w-3" />
			Verified Only ({result.verified_count})
		</button>
	</div>

	<!-- Issues List -->
	<div class="space-y-3">
		{#each filteredIssues as issue (issue.id)}
			<IssueCard {issue} />
		{/each}

		{#if filteredIssues.length === 0}
			<div class="text-center py-8 text-muted-foreground">
				No issues match the current filter.
			</div>
		{/if}
	</div>

	<!-- Timing -->
	<div class="text-xs text-muted-foreground flex items-center gap-4">
		<div class="flex items-center gap-1">
			<Clock class="h-3 w-3" />
			Analysis: {result.analysis_time_seconds.toFixed(1)}s
		</div>
		<div class="flex items-center gap-1">
			<Clock class="h-3 w-3" />
			Verification: {result.verification_time_seconds.toFixed(1)}s
		</div>
	</div>
</div>
