/**
 * Story Registry - Auto-discovers *.story.svelte files using import.meta.glob
 */

export interface StoryMeta {
  title: string;
  description?: string;
  category?: string;
}

export interface StoryModule {
  default: any; // Svelte component
  meta?: StoryMeta;
}

export interface StoryEntry {
  id: string;
  path: string;
  meta: StoryMeta;
  component: any;
}

export interface CategoryGroup {
  name: string;
  stories: StoryEntry[];
}

// Import all story files from the parent src directory
const storyModules = import.meta.glob<StoryModule>('$ui/**/*.story.svelte', {
  eager: true,
});

/**
 * Parse a story file path to extract component name and category
 */
function parseStoryPath(path: string): { id: string; defaultTitle: string; defaultCategory: string } {
  // Path format: $ui/components/Button.story.svelte or $ui/byok/ModelSelector.story.svelte
  const parts = path.replace('$ui/', '').replace('.story.svelte', '').split('/');
  const filename = parts[parts.length - 1];

  // Determine category from path
  let defaultCategory = 'Other';
  if (parts[0] === 'components') {
    if (parts.includes('user-settings')) {
      defaultCategory = 'Settings';
    } else if (filename.startsWith('Demo')) {
      defaultCategory = 'Layout';
    } else {
      defaultCategory = 'Core UI';
    }
  } else if (parts[0] === 'byok') {
    defaultCategory = 'BYOK';
  }

  // Create a URL-friendly ID
  const id = filename.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return {
    id,
    defaultTitle: filename,
    defaultCategory,
  };
}

/**
 * Get all discovered stories
 */
export function getStories(): StoryEntry[] {
  const stories: StoryEntry[] = [];

  for (const [path, module] of Object.entries(storyModules)) {
    const { id, defaultTitle, defaultCategory } = parseStoryPath(path);

    stories.push({
      id,
      path,
      meta: {
        title: module.meta?.title ?? defaultTitle,
        description: module.meta?.description,
        category: module.meta?.category ?? defaultCategory,
      },
      component: module.default,
    });
  }

  // Sort stories by title
  return stories.sort((a, b) => a.meta.title.localeCompare(b.meta.title));
}

/**
 * Get stories grouped by category
 */
export function getStoriesByCategory(): CategoryGroup[] {
  const stories = getStories();
  const categoryMap = new Map<string, StoryEntry[]>();

  // Group stories by category
  for (const story of stories) {
    const category = story.meta.category ?? 'Other';
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(story);
  }

  // Define category order
  const categoryOrder = ['Core UI', 'AI Components', 'BYOK', 'Layout', 'Settings', 'Other'];

  // Convert to array and sort
  const categories: CategoryGroup[] = [];
  for (const name of categoryOrder) {
    const stories = categoryMap.get(name);
    if (stories && stories.length > 0) {
      categories.push({ name, stories });
    }
  }

  // Add any categories not in the predefined order
  for (const [name, stories] of categoryMap) {
    if (!categoryOrder.includes(name)) {
      categories.push({ name, stories });
    }
  }

  return categories;
}

/**
 * Get a story by its ID
 */
export function getStoryById(id: string): StoryEntry | undefined {
  return getStories().find(story => story.id === id);
}
