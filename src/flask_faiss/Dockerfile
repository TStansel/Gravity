FROM python:3.8

COPY ./* ./app/

WORKDIR /app/

RUN pip install -r requirements.txt

EXPOSE 80

CMD ["python", "application.py"]