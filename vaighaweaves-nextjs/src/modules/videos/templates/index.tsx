import VideoPlayer from "@modules/videos/components/video-player"

type Video = {
  id: string
  videoId: string
  title: string
  description?: string
  thumbnail?: string
}

type VideosTemplateProps = {
  videos: Video[]
}

export default function VideosTemplate({ videos }: VideosTemplateProps) {
  return (
    <div className="content-container py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-semibold mb-3">Saree Styling Videos</h1>
        <p className="text-ui-fg-subtle max-w-xl mx-auto">
          Watch how to drape and style our handloom sarees with these helpful
          tutorials.
        </p>
      </div>

      {videos.length === 0 ? (
        <p className="text-center text-ui-fg-subtle py-16">
          No videos available yet. Check back soon!
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <div key={video.id} className="flex flex-col gap-3">
              <VideoPlayer
                videoId={video.videoId}
                title={video.title}
                thumbnail={video.thumbnail}
              />
              <div>
                <h2 className="font-medium text-ui-fg-base">{video.title}</h2>
                {video.description && (
                  <p className="text-sm text-ui-fg-subtle mt-1">
                    {video.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
