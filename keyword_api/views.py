# keyword_api/views.py

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
import requests
from django.core.cache import cache
import time

def get_google_suggestions(keyword):
    """
    Fetches autocomplete suggestions from Google for a given keyword.
    """
    # The cache key will be based on the keyword itself
    cache_key = f"suggestions:{keyword}"
    cached_suggestions = cache.get(cache_key)

    if cached_suggestions:
        return cached_suggestions

    # Use client=chrome to get relevance scores which we'll use as volume estimates
    url = f"http://suggestqueries.google.com/complete/search?client=chrome&q={keyword}"
    response = requests.get(url)
    response.raise_for_status()  # Raise an exception for bad status codes
    data = response.json()
    
    suggestion_strings = data[1]
    relevance_scores = []
    # Safely check if the relevance data exists before trying to access it
    if len(data) > 4 and isinstance(data[4], dict):
        relevance_scores = data[4].get('google:suggestrelevance', [])

    # Combine suggestions with their relevance scores (volume)
    suggestions = []
    for i, suggestion_string in enumerate(suggestion_strings):
        suggestions.append({
            "keyword": suggestion_string,
            "volume": relevance_scores[i] if i < len(relevance_scores) else 0
        })

    cache.set(cache_key, suggestions, timeout=3600) # Cache for 1 hour
    return suggestions

@api_view(['POST'])
def analyze_keyword(request):
    keyword = request.data.get('keyword')

    if not keyword:
        return Response({"status": "error", "message": "No keyword"}, status=400)

    try:
        suggestions = get_google_suggestions(keyword)
    except requests.exceptions.RequestException as e:
        # Handle potential network errors or bad responses from Google's API
        return Response({"status": "error", "message": f"Failed to fetch suggestions: {e}"}, status=502)

    return Response({
        "status": "success",
        "related_keywords": suggestions
    }, status=status.HTTP_200_OK)
