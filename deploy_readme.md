# Gringotts Lambda Deployment

## Overview

This document explains how to build and deploy the Lambda function for the Gringotts spending tracker.

## Prerequisites

- Python 3.x (for building the zip)
- AWS CLI configured with the `eem-personal` profile
- Node.js dependencies installed in `lambda/node_modules`

## Building the Zip File

The zip file must use forward slashes for Linux compatibility. On Windows, use Python to create the zip:

```bash
python -c "
import zipfile
import os

lambda_dir = 'lambda'
zip_path = 'gringotts-lambda.zip'

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(lambda_dir):
        dirs[:] = [d for d in dirs if d != '.git']
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, lambda_dir).replace(os.sep, '/')
            zf.write(file_path, arcname)
            print(f'Added: {arcname}')

print(f'Created {zip_path}')
"
```

This creates `gringotts-lambda.zip` in the repository root with Linux-compatible paths.

## Deploying to AWS

Deploy the zip file to AWS Lambda:

```bash
aws lambda update-function-code \
    --function-name gringotts_handlers \
    --zip-file fileb://gringotts-lambda.zip \
    --profile eem-personal \
    --region us-east-1
```

## Verify Deployment

Check that the function is active:

```bash
aws lambda get-function \
    --function-name gringotts_handlers \
    --profile eem-personal \
    --region us-east-1 \
    --query "Configuration.{State:State,LastUpdateStatus:LastUpdateStatus}"
```

Expected output:
```json
{
    "State": "Active",
    "LastUpdateStatus": "Successful"
}
```

## Lambda Configuration

- **Function name:** `gringotts_handlers`
- **Region:** `us-east-1`
- **Runtime:** Node.js 24.x
- **Handler:** `index.handler`
- **API Gateway:** `https://7lmkdtlssd.execute-api.us-east-1.amazonaws.com`
