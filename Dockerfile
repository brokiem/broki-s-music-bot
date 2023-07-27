# Use the official Golang image as the base image
FROM golang:1.20-alpine3.17

# Set the working directory inside the container
WORKDIR /app

# Copy go.mod and go.sum to the container and install dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code to the container
COPY . .

# Build the Golang application inside the container
RUN go build -o app

# Set the entry point for the container (the command to run when the container starts)
ENTRYPOINT ["./app"]
