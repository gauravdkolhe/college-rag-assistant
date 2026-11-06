from __future__ import annotations

from typing import Any
from uuid import UUID

from qdrant_client import QdrantClient, models


class QdrantCollection:
    def __init__(self, client: QdrantClient, name: str) -> None:
        self.client = client
        self.name = name
        self._ready = False

    def _ensure_collection(self, vector_size: int) -> None:
        if self._ready:
            return
        if not self.client.collection_exists(self.name):
            self.client.create_collection(
                collection_name=self.name,
                vectors_config=models.VectorParams(
                    size=vector_size,
                    distance=models.Distance.COSINE,
                ),
            )
        self._ready = True

    @staticmethod
    def _point_id(identifier: str) -> str:
        return str(UUID(identifier[:32]))

    @staticmethod
    def _source_filter(source: str) -> models.Filter:
        return models.Filter(
            must=[
                models.FieldCondition(
                    key="source",
                    match=models.MatchValue(value=source),
                )
            ]
        )

    def count(self) -> int:
        if not self.client.collection_exists(self.name):
            return 0
        return self.client.count(collection_name=self.name, exact=True).count

    def get(
        self,
        where: dict[str, str] | None = None,
        include: list[str] | None = None,
    ) -> dict[str, list[Any]]:
        if not self.client.collection_exists(self.name):
            return {"ids": [], "metadatas": []}
        records, _ = self.client.scroll(
            collection_name=self.name,
            scroll_filter=(
                self._source_filter(where["source"])
                if where and "source" in where
                else None
            ),
            limit=10000,
            with_payload=True,
            with_vectors=False,
        )
        return {
            "ids": [
                str(record.payload.get("original_id"))
                for record in records
                if record.payload and record.payload.get("original_id")
            ],
            "metadatas": [
                {
                    key: value
                    for key, value in record.payload.items()
                    if key not in {"original_id", "text"}
                }
                for record in records
                if record.payload
            ],
        }

    def upsert(
        self,
        ids: list[str],
        documents: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict[str, object]],
    ) -> None:
        if not embeddings:
            return
        self._ensure_collection(len(embeddings[0]))
        points = [
            models.PointStruct(
                id=self._point_id(identifier),
                vector=embedding,
                payload={
                    **metadata,
                    "original_id": identifier,
                    "text": document,
                },
            )
            for identifier, document, embedding, metadata in zip(
                ids, documents, embeddings, metadatas
            )
        ]
        self.client.upsert(collection_name=self.name, points=points, wait=True)

    def delete(
        self,
        where: dict[str, str] | None = None,
        ids: list[str] | None = None,
    ) -> None:
        if not self.client.collection_exists(self.name):
            return
        if ids:
            self.client.delete(
                collection_name=self.name,
                points_selector=models.PointIdsList(
                    points=[self._point_id(identifier) for identifier in ids]
                ),
                wait=True,
            )
        elif where and "source" in where:
            self.client.delete(
                collection_name=self.name,
                points_selector=models.FilterSelector(
                    filter=self._source_filter(where["source"])
                ),
                wait=True,
            )

    def query(
        self,
        query_embeddings: list[list[float]],
        n_results: int,
        include: list[str],
    ) -> dict[str, list[list[Any]]]:
        if not query_embeddings or not self.client.collection_exists(self.name):
            return {"documents": [[]], "metadatas": [[]], "distances": [[]]}
        results = self.client.query_points(
            collection_name=self.name,
            query=query_embeddings[0],
            limit=n_results,
            with_payload=True,
            with_vectors=False,
        ).points
        return {
            "documents": [[point.payload.get("text") for point in results]],
            "metadatas": [
                [
                    {
                        key: value
                        for key, value in point.payload.items()
                        if key not in {"original_id", "text"}
                    }
                    for point in results
                ]
            ],
            "distances": [[1.0 - float(point.score) for point in results]],
        }
