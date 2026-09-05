FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN sed -i \
		-e 's|http://deb.debian.org/debian-security|https://deb.debian.org/debian-security|g' \
		-e 's|http://deb.debian.org/debian|https://mirror.bizflycloud.vn/debian|g' \
		/etc/apt/sources.list.d/debian.sources \
	&& apt-get update \
	&& apt-get install -y --no-install-recommends \
		libcairo2 \
		libglib2.0-0 \
		libgomp1 \
		libjpeg62-turbo \
		libpng16-16 \
	&& rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir --timeout 120 --retries 5 -r requirements.txt
COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
