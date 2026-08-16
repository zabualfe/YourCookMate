from app.services.link_metadata import (
    extract_direct_video_urls,
    needs_redirect_resolution,
    parse_open_graph,
    prefers_direct_download,
)


def test_instagram_share_and_tiktok_short_need_resolution():
    assert needs_redirect_resolution("https://www.instagram.com/share/reel/AbC123xyz")
    assert needs_redirect_resolution("https://vm.tiktok.com/ZMabcdef/")
    assert needs_redirect_resolution("https://www.tiktok.com/t/ZTabc123/")
    assert not needs_redirect_resolution("https://www.tiktok.com/@chef/video/7123456789012345678")
    assert not needs_redirect_resolution("https://www.instagram.com/reel/AbC123xyz/")


def test_parse_open_graph_caption_and_image():
    page = """
    <html><head>
      <meta property="og:title" content="Garlic pasta" />
      <meta property="og:description" content="1 cup flour. Mix and bake 20 min." />
      <meta property="og:image" content="https://cdn.example/thumb.jpg" />
    </head></html>
    """
    info = parse_open_graph(page, "https://www.instagram.com/reel/AbC/")
    assert info is not None
    assert info["title"] == "Garlic pasta"
    assert "flour" in info["description"]
    assert info["thumbnail"] == "https://cdn.example/thumb.jpg"


def test_parse_open_graph_content_before_property():
    page = '<meta content="Lemon chicken" property="og:title" />'
    info = parse_open_graph(page, "https://tiktok.com/@x/video/1")
    assert info is not None
    assert info["title"] == "Lemon chicken"


def test_extract_direct_video_urls_prefers_download_addr():
    page = r'''
    {"playAddr":"https://cdn.example/play\u002Fclip.mp4","downloadAddr":"https://cdn.example/dl\u002Fclip.mp4"}
    '''
    urls = extract_direct_video_urls(page)
    assert urls[0] == "https://cdn.example/dl/clip.mp4"
    assert "https://cdn.example/play/clip.mp4" in urls


def test_prefers_direct_download_for_short_form():
    assert prefers_direct_download("https://www.tiktok.com/@chef/video/1")
    assert prefers_direct_download("https://www.instagram.com/reel/AbC/")
    assert not prefers_direct_download("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

