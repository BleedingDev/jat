/**
 * Navigation Configuration
 * Lightweight config structure for dashboard pages (~50 lines, not 874)
 */

export interface ViewToggleOption {
	value: string;
	label: string;
	link?: string; // For cross-page navigation (e.g., List View → /)
}

export interface BreadcrumbItem {
	label: string;
	href?: string; // Omit for current page (last item)
}

export interface NavConfig {
	title: string;
	subtitle: string;
	viewToggle?: ViewToggleOption[];
	showProjectFilter?: boolean;
	showThemeSelector?: boolean;
	breadcrumbs?: BreadcrumbItem[]; // Navigation path
}

// Home Page (List View)
export const homeConfig: NavConfig = {
	title: 'Beads Task Dashboard',
	subtitle: 'Multi-project task management powered by Beads + Agent Mail',
	viewToggle: [
		{ value: 'list', label: 'List' },
		{ value: 'graph', label: 'Graph' }
	],
	showProjectFilter: false,
	showThemeSelector: true,
	breadcrumbs: [
		{ label: 'Home' } // Current page, no href
	]
};

// Agents Page (Agent View)
export const agentsConfig: NavConfig = {
	title: 'Agents',
	subtitle: 'Task assignment and agent coordination powered by Agent Mail + Beads',
	viewToggle: [
		{ value: 'list', label: 'List View', link: '/' },
		{ value: 'agents', label: 'Agent View', link: '/agents' }
	],
	showProjectFilter: true,
	showThemeSelector: true,
	breadcrumbs: [
		{ label: 'Home', href: '/' },
		{ label: 'Agents' } // Current page
	]
};

// API Demo Page
export const apiDemoConfig: NavConfig = {
	title: 'Agents API Demo',
	subtitle: 'Live integration showcase for /api/agents endpoint + reactive store',
	viewToggle: undefined, // No view toggle on this page
	showProjectFilter: false,
	showThemeSelector: true,
	breadcrumbs: [
		{ label: 'Home', href: '/' },
		{ label: 'API Demo' } // Current page
	]
};
