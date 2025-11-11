import hashlib
import json
from io import BytesIO

from flask import Flask, request, jsonify, session, send_file
from functools import wraps
from flask_cors import CORS

from backend.RSDB_kv_service import get_kv, set_kv
from backend.error import ErrorCode
from backend.ipfs import add_file_to_cluster, download_file_from_ipfs
from backend.node import Node
from backend.share_manager import ShareManager
from backend.user_authentication_service import login, sign_up
from backend.file import File
from backend.delete_service import delete_node
from backend.util import validate_file_size

from backend.rag_utils import get_rag_manager, get_llm_integration
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

FILE_SIZE_LIMIT = 1024 * 1024  # 1 MB limit
app = Flask(__name__)

import os
from dotenv import load_dotenv
load_dotenv()
allowed_origins = ['http://localhost:5997', 'http://127.0.0.1:5997', 'https://res-share-deployable.vercel.app']
additional_origins = os.environ.get('CORS_ORIGINS', '')
if additional_origins:
    allowed_origins.extend([origin.strip() for origin in additional_origins.split(',') if origin.strip()])

CORS(app, origins=allowed_origins, supports_credentials=True)

secret_key = os.environ.get('FLASK_SECRET_KEY')
if not secret_key:
    raise RuntimeError("FLASK_SECRET_KEY is required in production for session management")
app.secret_key = secret_key

is_development = os.environ.get('FLASK_ENV', 'development') == 'development'
if is_development:
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['SESSION_COOKIE_SECURE'] = False
else:
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'None'  # Required for cross-origin cookies
    app.config['SESSION_COOKIE_SECURE'] = True  # Required when SameSite=None
app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 hours
app.config['SESSION_COOKIE_NAME'] = 'session'
app.config['SESSION_COOKIE_DOMAIN'] = None
app.config['SESSION_COOKIE_PATH'] = '/'

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            logger.info("User not logged in")
            return jsonify({'message': ErrorCode.NOT_LOGGED_IN.name}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/login', methods=['POST'])
def login_route():    
    data = request.get_json()
    username = data['username']
    password = data['password']

    result = login(username, password)

    if result == ErrorCode.SUCCESS:
        session['username'] = username
        session.permanent = True
        root_json = get_kv(username + " ROOT")
        root_json = json.loads(root_json)
        share_list = get_kv(username + " SHARE_MANAGER")
        share_list = json.loads(share_list)
        
        response = jsonify({
            'result': result.name,
            'root': root_json,
            'share_list': share_list
        })
        
        logger.info(f"Response headers: {dict(response.headers)}")
        return response, 200

    return jsonify({'result': result.name}), 401

@app.route('/signup', methods=['POST'])
def signup_route():
    data = request.get_json()
    username = data['username']
    password = data['password']
    result = sign_up(username, password)
    if result == ErrorCode.SUCCESS:
        return jsonify({
            'ok': "true",
            'result': result.name
        }), 200

    return jsonify({'result': result.name}), 401

@app.route('/create-folder', methods=['POST'])
@login_required
def create_folder_route():
    data = request.get_json()
    if 'folder_path' not in data:
        return jsonify({'result': ErrorCode.INVALID_REQUEST.name}), 400
    folder_path = data.get('folder_path')
    username = session['username']

    if not folder_path or folder_path.strip("/") == "":
        return jsonify({'result': ErrorCode.INVALID_PATH.name}), 400

    parts = folder_path.strip("/").split("/")
    folder_name = parts[-1]
    parent_path = "/".join(parts[:-1])

    root = Node.from_json(get_kv(username + " ROOT"))

    parent_node = root.find_node_by_path(parent_path) if parent_path else root
    if parent_node is None or not parent_node.is_folder:
        return jsonify({'result': ErrorCode.INVALID_PATH.name}), 400

    if folder_name in parent_node.children:
        return jsonify({'result': ErrorCode.DUPLICATE_NAME.name}), 409

    new_folder = Node(name=folder_name, is_folder=True)
    parent_node.add_child(new_folder)

    set_kv(username + " ROOT", root.to_json())

    return jsonify({'result': ErrorCode.SUCCESS.name,
                    'root': root.to_json()}), 201


@app.route('/delete', methods=['DELETE'])
@login_required
def delete_route():
    data = request.get_json()
    return delete_node(data)


@app.route('/share', methods=['POST'])
@login_required
def share_route():
    data = request.get_json()
    if 'target' not in data or 'node' not in data:
        return jsonify({'message': ErrorCode.INVALID_REQUEST.name}), 400
    username = session['username']
    target_username = data['target']
    node = data['node']
    try:
        node = Node.from_json(node)
    except json.JSONDecodeError:
        return jsonify({'message': "Failed to parse the JSON"}), 400
    if node.name == "root":
        return jsonify({'message': ErrorCode.SHARE_ROOT.name}), 400

    target_sm = get_kv(target_username + " SHARE_MANAGER")
    if target_sm == "\n" or target_sm == "" or target_sm == " ":
        return jsonify({'message': ErrorCode.INVALID_USERNAME.name}), 400

    target_sm = ShareManager.from_json(target_sm)
    result = target_sm.receive(username, node)
    if result != ErrorCode.SUCCESS:
        return jsonify({'message': result.name}), 400

    set_kv(target_username + " SHARE_MANAGER", target_sm.to_json())

    return jsonify({'message': ErrorCode.SUCCESS.name}), 200


@app.route('/delete-user', methods=['DELETE'])
@login_required
def delete_user_route():
    data = request.get_json()
    username = session['username']
    password = data['password']
    hashed_password = hashlib.sha256(password.encode()).hexdigest()

    if hashed_password != get_kv(username):
        return jsonify({'message': ErrorCode.INCORRECT_PASSWORD.name}), 401

    set_kv(username, "\n")
    set_kv(username + " ROOT", "\n")
    set_kv(username + " SHARE_MANAGER", "\n")

    session.pop('username')

    return jsonify({'message': ErrorCode.SUCCESS.name}), 200

@app.route('/logout', methods=['POST'])
@login_required
def logout_route():
    session.pop('username', None)
    return jsonify({'message': ErrorCode.SUCCESS.name}), 200

@app.route('/auth-status', methods=['GET'])
def auth_status():
    """Check if user has a valid session and return user data if authenticated"""
    if 'username' in session:
        username = session['username']
        try:
            root_json = get_kv(username + " ROOT")
            share_list = get_kv(username + " SHARE_MANAGER")

            if root_json and share_list and root_json != "\n" and share_list != "\n":
                return jsonify({
                    'authenticated': True,
                    'username': username,
                    'root': json.loads(root_json),
                    'share_list': json.loads(share_list)
                }), 200
            else:
                session.pop('username', None)
                return jsonify({'authenticated': False}), 401
        except Exception as e:
            logger.error(f"Error checking auth status: {e}")
            session.pop('username', None)
            return jsonify({'authenticated': False}), 401

    return jsonify({'authenticated': False}), 401


@app.route('/upload', methods=['POST'])
@login_required
def upload_route():
    """
    Upload file to IPFS and process for RAG if it's a supported text format.
    if user want to upload example.txt to path root/doc/example.txt. The path part in request should be root/doc
    """
    if 'file' not in request.files:
        return jsonify({'message': ErrorCode.INVALID_REQUEST.name}), 400

    if 'path' not in request.form:
        return jsonify({'message': ErrorCode.INVALID_REQUEST.name}), 400

    path = request.form['path']
    username = session['username']
    file = request.files['file']
    raw_skip_flag = request.form.get('skip_ai_processing', 'false')
    skip_ai_processing = raw_skip_flag.lower() == 'true'
    logger.info(f"Upload request: user={username}, file={file.filename if file else 'N/A'}, skip_ai_processing_raw='{raw_skip_flag}', parsed={skip_ai_processing}")

    if file.filename == '':
        return jsonify({'message': ErrorCode.INVALID_REQUEST.name}), 400

    filename = file.filename
    file_stream = BytesIO(file.read())

    file_size = file_stream.getbuffer().nbytes

    # Validate file size
    is_valid, error_message = validate_file_size(file_size, FILE_SIZE_LIMIT)
    if not is_valid:
        return jsonify({'message': error_message}), 413

    cid = add_file_to_cluster(file_stream, filename)

    if cid is None:
        return jsonify({'message': ErrorCode.IPFS_ERROR.name}), 500

    root = Node.from_json(get_kv(username + " ROOT"))
    target_node = root.find_node_by_path(path)

    if target_node is None:
        return jsonify({'message': ErrorCode.NODE_NOT_FOUND.name}), 404

    result = target_node.add_child(Node(filename, False, file_obj=File(cid, file_size, filename)))

    if result != ErrorCode.SUCCESS:
        return jsonify({'message': result.name}), 400

    set_kv(username + " ROOT", root.to_json())

    rag_success = False
    rag_skipped = False
    
    if not skip_ai_processing:
        supported_extensions = {'pdf', 'docx', 'txt'}
        file_extension = filename.lower().split('.')[-1] if '.' in filename else ''
        
        if file_extension in supported_extensions:
            try:
                file_stream.seek(0)
                file_content = file_stream.read()
                
                rag_manager = get_rag_manager()
                rag_success = rag_manager.process_file_for_rag(file_content, filename, username, cid)
                
                if rag_success:
                    logger.info(f"Successfully processed {filename} for RAG for user {username}")
                else:
                    logger.warning(f"Failed to process {filename} for RAG for user {username}")
                    
            except Exception as e:
                logger.error(f"RAG processing error for {filename}: {e}")
                rag_success = False
    else:
        rag_skipped = True
        logger.info(f"RAG processing skipped for {filename} for user {username} (AI mode disabled)")

    response_data = {
        'message': ErrorCode.SUCCESS.name, 
        'root': root.to_json(),
        'rag_processed': rag_success,
        'rag_skipped': rag_skipped,
        'skip_ai_processing': skip_ai_processing
    }
    
    return jsonify(response_data), 200


@app.route('/chat', methods=['POST'])
@login_required
def chat_route():
    """
    RAG-powered chat endpoint that answers questions based on user's uploaded files
    """
    try:
        data = request.get_json()
        
        if not data or 'query' not in data:
            return jsonify({'error': 'Query is required'}), 400
        
        query = data['query'].strip()
        if not query:
            return jsonify({'error': 'Query cannot be empty'}), 400
        
        username = session['username']
        
        rag_manager = get_rag_manager()
        relevant_chunks = rag_manager.search_user_vector_db(username, query, top_k=5)
        
        if not relevant_chunks:
            return jsonify({
                'answer': "I couldn't find any relevant information in your uploaded files to answer this question. Please make sure you have uploaded text-based documents (PDF, DOCX, or TXT files).",
                'sources': [],
                'chunks_found': 0
            }), 200
        
        llm_integration = get_llm_integration()
        answer = llm_integration.generate_answer(query, relevant_chunks)
        
        sources = []
        seen_files = set()
        for chunk in relevant_chunks:
            filename = chunk['chunk']['metadata']['filename']
            if filename not in seen_files:
                sources.append({
                    'filename': filename,
                    'score': chunk['score']
                })
                seen_files.add(filename)
        
        return jsonify({
            'answer': answer,
            'sources': sources,
            'chunks_found': len(relevant_chunks)
        }), 200
        
    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        return jsonify({'error': 'An error occurred while processing your question'}), 500


@app.route('/chat/stats', methods=['GET'])
@login_required
def chat_stats_route():
    """
    Get statistics about user's RAG database
    """
    try:
        username = session['username']
        rag_manager = get_rag_manager()
        stats = rag_manager.get_user_stats(username)
        
        return jsonify(stats), 200
        
    except Exception as e:
        logger.error(f"Chat stats error: {e}")
        return jsonify({'error': 'Failed to get chat statistics'}), 500


@app.route('/download', methods=['POST'])
@login_required
def download_route():
    data = request.get_json()
    if not data or 'path' not in data:
        return jsonify({'message': ErrorCode.INVALID_PATH.name}), 400

    path = data['path']
    username = session['username']
    is_shared = data.get('is_shared', False)

    if is_shared:
        share_manager = ShareManager.from_json(get_kv(username + " SHARE_MANAGER"))
        target_node = share_manager.find_node_by_path(path)
    else:
        root = Node.from_json(get_kv(username + " ROOT"))
        target_node = root.find_node_by_path(path)

    if target_node is None or target_node.is_folder:
        return jsonify({'message': ErrorCode.NODE_NOT_FOUND.name}), 404

    file_obj = target_node.file_obj
    if not file_obj:
        return jsonify({'message': ErrorCode.FILE_NOT_FOUND.name}), 404

    file_content = download_file_from_ipfs(file_obj.cid)
    if not file_content or not file_content.get("success"):
        return jsonify({'message': ErrorCode.IPFS_ERROR.name if file_content is None else file_content.get('message', ErrorCode.IPFS_ERROR.name)}), 500
    
    file_stream = BytesIO(file_content["file"].getvalue())
    file_stream.seek(0)
    
    return send_file(
        file_stream,
        mimetype='application/octet-stream',
        as_attachment=True,
        download_name=file_obj.filename
    )
@app.route('/', methods=['GET'])
def health_route():
    return jsonify({'message': 'OK'}), 200

if __name__ == '__main__':
    import os
    debug_mode = os.environ.get('FLASK_ENV', 'production') != 'production'
    app.run(host='0.0.0.0', port=5000, debug=debug_mode)