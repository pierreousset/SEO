# SEO Dashboard API Reference

## Overview

**Base URL:** `https://app.seodashboard.com/api/v1`

**Authentication:**  
All requests require a Bearer token passed in the `Authorization` header.  
`Authorization: Bearer <your_token>`

**Rate Limit:**  
100 requests per minute per token.

---

## Endpoints

### Get Tracked Keywords
**GET** `/api/v1/keywords`

Returns all tracked keywords with their latest SERP position.

**Authentication:** Bearer token required.

**Example Request:**
```bash
curl -X GET "https://app.seodashboard.com/api/v1/keywords" \
     -H "Authorization: Bearer <your_token>"
```

**Example Response:**
```json
{
  "keywords": [
    {
      "id": "kw_abc123",
      "query": "best project management tools",
      "position": 4,
      "previousPosition": 7,
      "intentStage": "commercial",
      "site": "example.com"
    }
  ]
}
```

---

### Get Health Score
**GET** `/api/v1/health-score`

Returns the latest SEO health score and detected on-page issues.

**Authentication:** Bearer token required.

**Example Request:**
```bash
curl -X GET "https://app.seodashboard.com/api/v1/health-score" \
     -H "Authorization: Bearer <your_token>"
```

**Example Response:**
```json
{
  "score": 72,
  "breakdown": {
    "titleQuality": 80,
    "metaQuality": 65,
    "headingStructure": 70,
    "internalLinking": 74
  },
  "issues": [
    {
      "type": "meta_description",
      "severity": "warning",
      "title": "Missing meta descriptions",
      "description": "12 pages are missing meta descriptions.",
      "impact": "medium"
    }
  ]
}
```

---

### Get Position History
**GET** `/api/v1/positions`

Returns historical position data for a specific keyword over a given number of days.

**Authentication:** Bearer token required.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `keywordId` | string | Yes | - | The unique ID of the keyword. |
| `days` | integer | No | 30 | Number of days of historical data to return. |

**Example Request:**
```bash
curl -X GET "https://app.seodashboard.com/api/v1/positions?keywordId=kw_abc123&days=30" \
     -H "Authorization: Bearer <your_token>"
```

**Example Response:**
```json
{
  "positions": [
    { "date": "2026-04-15", "position": 4 },
    { "date": "2026-04-14", "position": 5 }
  ]
}
```

---

### Get Crawled Pages
**GET** `/api/v1/pages`

Returns all crawled pages with their SEO metrics from the latest site crawl.

**Authentication:** Bearer token required.

**Example Request:**
```bash
curl -X GET "https://app.seodashboard.com/api/v1/pages" \
     -H "Authorization: Bearer <your_token>"
```

**Example Response:**
```json
{
  "pages": [
    {
      "url": "https://example.com/blog/seo-tips",
      "title": "10 SEO Tips for 2026",
      "metaDescription": "Learn the top SEO strategies...",
      "h1": "10 SEO Tips for 2026",
      "inSitemap": true,
      "indexable": true,
      "httpStatus": 200
    }
  ]
}
```

---

## Errors

| Code | Description |
| :--- | :--- |
| **401** | **Unauthorized:** Bearer token is missing or invalid. |
| **429** | **Rate Limited:** Too many requests (maximum 100/min). |
| **500** | **Internal Server Error:** An unexpected error occurred on the server. |
