<script lang="ts">
	import { 
		Download, CheckCircle, XCircle, AlertCircle,
		Bug, Shield, Zap, Clock, Scale, Lightbulb,
		ChevronDown, ChevronUp
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

	type FilterType = 'all' | 'defects' | 'tradeoffs' | 'observations' | 'critical' | 'security' | 'verified';
	let filter: FilterType = 'all';

	// Classify issues by type
	$: defects = result.issues.filter(i => i.issue_type === 'defect' || (!i.issue_type && i.category !== 'architecture'));
	$: tradeoffs = result.issues.filter(i => i.issue_type === 'tradeoff');
	$: observations = result.issues.filter(i => i.issue_type === 'observation' || (!i.issue_type && i.category === 'architecture'));

	// If backend hasn't classified yet (pre-v0.9.0), auto-classify based on heuristics
	$: hasIssueTypes = result.issues.some(i => i.issue_type);
	$: classifiedIssues = hasIssueTypes ? result.issues : result.issues.map(i => ({
		...i,
		issue_type: i.category === 'architecture' ? 'observation' : 'defect'
	}));

	$: defectCount = classifiedIssues.filter(i => i.issue_type === 'defect').length;
	$: tradeoffCount = classifiedIssues.filter(i => i.issue_type === 'tradeoff').length;
	$: observationCount = classifiedIssues.filter(i => i.issue_type === 'observation').length;

	$: filteredIssues = classifiedIssues.filter(issue => {
		if (filter === 'all') return true;
		if (filter === 'defects') return issue.issue_type === 'defect';
		if (filter === 'tradeoffs') return issue.issue_type === 'tradeoff';
		if (filter === 'observations') return issue.issue_type === 'observation';
		if (filter === 'critical') return issue.severity === 'critical' || issue.severity === 'high';
		if (filter === 'security') return issue.category === 'security';
		if (filter === 'verified') return issue.verification_status === 'verified';
		return true;
	});

	// Group filtered issues by type for sectioned display
	$: groupedDefects = filteredIssues.filter(i => i.issue_type === 'defect');
	$: groupedTradeoffs = filteredIssues.filter(i => i.issue_type === 'tradeoff');
	$: groupedObservations = filteredIssues.filter(i => i.issue_type === 'observation');

	$: severityCounts = {
		critical: result.issues.filter(i => i.severity === 'critical').length,
		high: result.issues.filter(i => i.severity === 'high').length,
		medium: result.issues.filter(i => i.severity === 'medium').length,
		low: result.issues.filter(i => i.severity === 'low').length,
	};

	// Health score calculation
	$: criticalDefects = classifiedIssues.filter(i => 
		i.issue_type === 'defect' && (i.severity === 'critical' || i.severity === 'high') && i.verification_status === 'verified'
	).length;
	$: verifiedDefects = classifiedIssues.filter(i => 
		i.issue_type === 'defect' && i.verification_status === 'verified'
	).length;
	$: healthScore = Math.max(0, 100 - (criticalDefects * 20) - (verifiedDefects * 5) - (tradeoffCount * 2) - (observationCount * 1));
	$: healthColor = healthScore >= 80 ? 'text-green-400' : healthScore >= 60 ? 'text-yellow-400' : 'text-red-400';
	$: healthBg = healthScore >= 80 ? 'bg-green-500/10 border-green-500/20' : healthScore >= 60 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-red-500/10 border-red-500/20';
	$: healthVerdict = criticalDefects === 0 && verifiedDefects === 0
		? 'No verified defects found'
		: criticalDefects > 0
			? `${criticalDefects} critical/high defect${criticalDefects > 1 ? 's' : ''} found`
			: `${verifiedDefects} verified defect${verifiedDefects > 1 ? 's' : ''} found`;

	function exportToMarkdown() {
		const date = new Date().toISOString().split('T')[0];
		
		let md = `# Codebase Analysis Report

**Repository:** ${result.repo_url}
**Date:** ${date}
**Focus:** ${result.focus}
**Health Score:** ${healthScore}/100
**Analysis Time:** ${result.analysis_time_seconds.toFixed(1)}s
**Verification Time:** ${result.verification_time_seconds.toFixed(1)}s

## Summary

- **${result.total_issues} findings** (${defectCount} defects, ${tradeoffCount} tradeoffs, ${observationCount} observations)
- **${result.verified_count} verified** (confirmed via automated tests)
- **${result.unverified_count} unverified** (may be false positives)
- **${result.files_analyzed} files analyzed**

### By Severity

| Severity | Count |
|----------|-------|
| Critical | ${severityCounts.critical} |
| High | ${severityCounts.high} |
| Medium | ${severityCounts.medium} |
| Low | ${severityCounts.low} |

---

`;

		// Group by type
		const groups = [
			{ label: 'Defects', issues: classifiedIssues.filter(i => i.issue_type === 'defect') },
			{ label: 'Design Tradeoffs', issues: classifiedIssues.filter(i => i.issue_type === 'tradeoff') },
			{ label: 'Observations', issues: classifiedIssues.filter(i => i.issue_type === 'observation') },
		];

		for (const group of groups) {
			if (group.issues.length === 0) continue;
			md += `## ${group.label}\n\n`;

			for (const issue of group.issues) {
				const statusIcon = issue.verification_status === 'verified' ? ' VERIFIED' : 
					issue.verification_status === 'unverified' ? ' UNVERIFIED' : '';
				
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
		}

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

	<!-- Health Score Banner -->
	<div class="rounded-lg border {healthBg} p-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="text-3xl font-bold {healthColor}">{healthScore}</div>
				<div>
					<div class="text-sm font-medium {healthColor}">Health Score</div>
					<div class="text-xs text-muted-foreground">{healthVerdict}</div>
				</div>
			</div>
			<div class="text-right text-xs text-muted-foreground">
				<div>{result.files_analyzed} files analyzed</div>
				<div>{result.analysis_time_seconds.toFixed(1)}s analysis + {result.verification_time_seconds.toFixed(1)}s verification</div>
			</div>
		</div>
	</div>

	<!-- Type Summary Cards -->
	<div class="grid grid-cols-3 gap-3">
		<button
			type="button"
			on:click={() => filter = filter === 'defects' ? 'all' : 'defects'}
			class="rounded-lg p-3 text-left transition-colors {filter === 'defects' ? 'bg-red-500/20 border border-red-500/40' : 'bg-secondary/50 border border-transparent hover:bg-secondary/80'}"
		>
			<div class="flex items-center gap-2 mb-1">
				<Bug class="h-4 w-4 text-red-400" />
				<span class="text-xs font-medium text-red-400">Defects</span>
			</div>
			<div class="text-2xl font-bold">{defectCount}</div>
			<div class="text-[10px] text-muted-foreground">Fix these</div>
		</button>
		<button
			type="button"
			on:click={() => filter = filter === 'tradeoffs' ? 'all' : 'tradeoffs'}
			class="rounded-lg p-3 text-left transition-colors {filter === 'tradeoffs' ? 'bg-blue-500/20 border border-blue-500/40' : 'bg-secondary/50 border border-transparent hover:bg-secondary/80'}"
		>
			<div class="flex items-center gap-2 mb-1">
				<Scale class="h-4 w-4 text-blue-400" />
				<span class="text-xs font-medium text-blue-400">Tradeoffs</span>
			</div>
			<div class="text-2xl font-bold">{tradeoffCount}</div>
			<div class="text-[10px] text-muted-foreground">Design decisions</div>
		</button>
		<button
			type="button"
			on:click={() => filter = filter === 'observations' ? 'all' : 'observations'}
			class="rounded-lg p-3 text-left transition-colors {filter === 'observations' ? 'bg-purple-500/20 border border-purple-500/40' : 'bg-secondary/50 border border-transparent hover:bg-secondary/80'}"
		>
			<div class="flex items-center gap-2 mb-1">
				<Lightbulb class="h-4 w-4 text-purple-400" />
				<span class="text-xs font-medium text-purple-400">Observations</span>
			</div>
			<div class="text-2xl font-bold">{observationCount}</div>
			<div class="text-[10px] text-muted-foreground">Suggestions</div>
		</button>
	</div>

	<!-- Severity + Filter Row -->
	<div class="flex items-center justify-between flex-wrap gap-2">
		<div class="flex items-center gap-3 text-sm">
			<span class="text-muted-foreground text-xs">Severity:</span>
			{#if severityCounts.critical > 0}
				<span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-red-500"></span>{severityCounts.critical} critical</span>
			{/if}
			{#if severityCounts.high > 0}
				<span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-orange-500"></span>{severityCounts.high} high</span>
			{/if}
			{#if severityCounts.medium > 0}
				<span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-yellow-500"></span>{severityCounts.medium} medium</span>
			{/if}
			{#if severityCounts.low > 0}
				<span class="flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-gray-500"></span>{severityCounts.low} low</span>
			{/if}
		</div>
		<div class="flex gap-1.5 flex-wrap">
			<button
				type="button"
				on:click={() => filter = 'all'}
				class="rounded-full px-2.5 py-1 text-xs transition-colors {filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'}"
			>All ({result.issues.length})</button>
			{#if severityCounts.critical + severityCounts.high > 0}
				<button
					type="button"
					on:click={() => filter = 'critical'}
					class="rounded-full px-2.5 py-1 text-xs transition-colors {filter === 'critical' ? 'bg-red-500 text-white' : 'bg-secondary hover:bg-secondary/80'}"
				>Critical/High</button>
			{/if}
			<button
				type="button"
				on:click={() => filter = 'security'}
				class="rounded-full px-2.5 py-1 text-xs transition-colors flex items-center gap-1 {filter === 'security' ? 'bg-purple-500 text-white' : 'bg-secondary hover:bg-secondary/80'}"
			>
				<Shield class="h-3 w-3" />
				Security
			</button>
			<button
				type="button"
				on:click={() => filter = 'verified'}
				class="rounded-full px-2.5 py-1 text-xs transition-colors flex items-center gap-1 {filter === 'verified' ? 'bg-green-500 text-white' : 'bg-secondary hover:bg-secondary/80'}"
			>
				<CheckCircle class="h-3 w-3" />
				Verified ({result.verified_count})
			</button>
		</div>
	</div>

	<!-- Grouped Issues Display -->
	<div class="space-y-6">
		<!-- Defects Section -->
		{#if groupedDefects.length > 0}
			<div class="space-y-3">
				<div class="flex items-center gap-2 text-sm font-medium">
					<Bug class="h-4 w-4 text-red-400" />
					<span class="text-red-400">Defects</span>
					<span class="text-muted-foreground">— Fix these</span>
				</div>
				{#each groupedDefects as issue (issue.id)}
					<IssueCard {issue} />
				{/each}
			</div>
		{/if}

		<!-- Tradeoffs Section -->
		{#if groupedTradeoffs.length > 0}
			<div class="space-y-3">
				<div class="flex items-center gap-2 text-sm font-medium">
					<Scale class="h-4 w-4 text-blue-400" />
					<span class="text-blue-400">Design Tradeoffs</span>
					<span class="text-muted-foreground">— Intentional decisions</span>
				</div>
				<div class="opacity-80">
					{#each groupedTradeoffs as issue (issue.id)}
						<div class="mb-3">
							<IssueCard {issue} />
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Observations Section -->
		{#if groupedObservations.length > 0}
			<div class="space-y-3">
				<div class="flex items-center gap-2 text-sm font-medium">
					<Lightbulb class="h-4 w-4 text-purple-400" />
					<span class="text-purple-400">Observations</span>
					<span class="text-muted-foreground">— Suggestions for improvement</span>
				</div>
				<div class="opacity-70">
					{#each groupedObservations as issue (issue.id)}
						<div class="mb-3">
							<IssueCard {issue} />
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if filteredIssues.length === 0}
			<div class="text-center py-8 text-muted-foreground">
				No findings match the current filter.
			</div>
		{/if}
	</div>

	<!-- Timing Footer -->
	<div class="text-xs text-muted-foreground flex items-center gap-4 pt-2 border-t border-border">
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
