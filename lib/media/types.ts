export interface MediaItem {
  id: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  publishedAt?: string;
}

/** Future-ready abstraction for a real YouTube sync worker. Not wired to a live API in the MVP. */
export interface MediaProvider {
  getLatestVideos(): Promise<MediaItem[]>;
}

export class NullMediaProvider implements MediaProvider {
  async getLatestVideos(): Promise<MediaItem[]> {
    return [];
  }
}

export interface PodcastEpisode {
  id: string;
  title: string;
  audioUrl: string;
  publishedAt?: string;
  description?: string;
}

/** Future-ready abstraction for a real podcast sync worker. */
export interface PodcastProvider {
  getEpisodes(): Promise<PodcastEpisode[]>;
}

export class NullPodcastProvider implements PodcastProvider {
  async getEpisodes(): Promise<PodcastEpisode[]> {
    return [];
  }
}
