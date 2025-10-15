import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Card,
  CardActionArea,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Snackbar,
  Alert,
  LinearProgress,
  Menu,
  MenuItem,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Add,
  CreateNewFolder,
  Upload,
  Folder,
  InsertDriveFile,
  Share,
  People,
  Storage,
  Delete,
  MoreVert,
  Download,
  Visibility,
  Psychology,
  SmartToy,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { fileAPI, utils } from '../utils/api';

const HomePage = () => {
  const navigate = useNavigate();
  const { user, rootData, shareList, setRootData, setShareList } = useAuth();
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalFolders: 0,
    sharedItems: 0,
  });
  const [selectedItem, setSelectedItem] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const fileInputRef = React.useRef(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUsername, setShareUsername] = useState('');
  const [aiModeEnabled, setAiModeEnabled] = useState(() => {
    const saved = localStorage.getItem('aiModeEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    if (rootData) {
      calculateStats(rootData);
    }
  }, [rootData, shareList]);

  const calculateStats = (node) => {
    let files = 0;
    let folders = 0;
    
    const traverse = (currentNode) => {
      if (currentNode.is_folder) {
        folders++;
        if (currentNode.children) {
          Object.values(currentNode.children).forEach(child => traverse(child));
        }
      } else {
        files++;
      }
    };

    if (node.children) {
      Object.values(node.children).forEach(child => traverse(child));
    }

    // Calculate shared items count from shareList object
    let sharedItemsCount = 0;
    if (shareList && typeof shareList === 'object') {
      Object.values(shareList).forEach(nodes => {
        if (Array.isArray(nodes)) {
          sharedItemsCount += nodes.length;
        }
      });
    }

    setStats({
      totalFiles: files,
      totalFolders: folders,
      sharedItems: sharedItemsCount,
    });
  };

  const handleSpeedDialToggle = () => {
    setSpeedDialOpen(!speedDialOpen);
  };

  const handleCreateFolder = () => {
    setCreateFolderOpen(true);
    setSpeedDialOpen(false);
  };

  const handleConfirmCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setSnackbar({
        open: true,
        message: 'Folder name cannot be empty',
        severity: 'error',
      });
      return;
    }

    const validationError = utils.validateFileName(newFolderName);
    if (validationError) {
      setSnackbar({
        open: true,
        message: validationError,
        severity: 'error',
      });
      return;
    }

    try {
      const response = await fileAPI.createFolder(newFolderName);
      
      if (response.result === 'SUCCESS') {
        setRootData(JSON.parse(response.root));
        setSnackbar({
          open: true,
          message: 'Folder created successfully!',
          severity: 'success',
        });
        setCreateFolderOpen(false);
        setNewFolderName('');
      } else {
        setSnackbar({
          open: true,
          message: response.result || 'Failed to create folder',
          severity: 'error',
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message || 'Failed to create folder',
        severity: 'error',
      });
    }
  };

  const handleUploadFile = () => {
    // Trigger file input click
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
    setSpeedDialOpen(false);
  };

  const handleFileSelected = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const sizeValidation = utils.validateFileSize(file, 1);
    if (!sizeValidation.isValid) {
      setSnackbar({
        open: true,
        message: sizeValidation.error,
        severity: 'error',
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      console.log('[HomePage] Uploading with aiModeEnabled=', aiModeEnabled, 'skip=', !aiModeEnabled);
      const response = await fileAPI.uploadFile(file, '', !aiModeEnabled);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.message === 'SUCCESS') {
        setRootData(JSON.parse(response.root));
        
        let message = 'File uploaded successfully!';
        if (response.rag_skipped) {
          message += ' AI processing was skipped.';
        } else if (response.rag_processed) {
          message += ' Ready for AI chat.';
        }
        
        setSnackbar({
          open: true,
          message: message,
          severity: 'success',
        });
      } else {
        setSnackbar({
          open: true,
          message: response.message || 'Failed to upload file',
          severity: 'error',
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message || 'Failed to upload file',
        severity: 'error',
      });
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleFolderClick = (folderName) => {
    navigate(`/explorer/${folderName}`);
  };

  const handleFileClick = (fileName, item) => {
    if (item.is_folder) {
      handleFolderClick(fileName);
    } else {
      handleDownload({ name: fileName, ...item });
    }
  };

  const handleMenuOpen = (event, item, isShared = false) => {
    event.stopPropagation();
    setSelectedItem({ ...item, isShared });
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedItem(null);
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    try {
      const response = await fileAPI.deleteItem(
        selectedItem.isShared ? selectedItem.sharedBy + "/" + selectedItem.name : selectedItem.name,
        !selectedItem.isShared
      );

      if (response.message === 'SUCCESS') {
        if (selectedItem.isShared) {
          // Update share list
          const updatedShareList = { ...shareList };
          const fromUser = selectedItem.sharedBy;
          if (updatedShareList[fromUser]) {
            updatedShareList[fromUser] = updatedShareList[fromUser].filter(
              node => node.name !== selectedItem.name
            );
            if (updatedShareList[fromUser].length === 0) {
              delete updatedShareList[fromUser];
            }
          }
          setShareList(updatedShareList);
        } else {
          // Update root data
          setRootData(JSON.parse(response.root));
        }

        setSnackbar({
          open: true,
          message: 'Item deleted successfully!',
          severity: 'success',
        });
      } else {
        setSnackbar({
          open: true,
          message: response.message || 'Failed to delete item',
          severity: 'error',
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message || 'Failed to delete item',
        severity: 'error',
      });
    }
    handleMenuClose();
  };

  const handleDownload = async (itemOrEvent) => {
    // If it's an event from the menu, use selectedItem
    const item = itemOrEvent?.target?.tagName ? selectedItem : itemOrEvent;
    if (!item) return;

    try {
      console.log("item", item);
      // Check if the item is from shared items section
      const isShared = item.sharedBy !== undefined;
      const filePath = isShared 
        ? `${item.sharedBy}/${item.name}`
        : item.name;
      console.log("filePath", filePath, "isShared", isShared);
      const response = await fileAPI.downloadFile(filePath, isShared);

      if (response.ok) {
        const blob = await response.blob();
        
        if ('showSaveFilePicker' in window) {
          try {
            const extension = item.name.split('.').pop();
            const mimeType = blob.type || 'application/octet-stream';
            
            const handle = await window.showSaveFilePicker({
              suggestedName: item.name,
              types: [{
                description: 'All Files',
                accept: {
                  [mimeType]: [`.${extension}`]
                }
              }]
            });
            
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            
            setSnackbar({
              open: true,
              message: 'File downloaded successfully!',
              severity: 'success',
            });
          } catch (err) {
            if (err.name !== 'AbortError') {
              console.error('Error saving file:', err);
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = item.name;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
              
              setSnackbar({
                open: true,
                message: 'File downloaded successfully!',
                severity: 'success',
              });
            }
          }
        } else {
          // Fallback for browsers that don't support File System Access API
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = item.name;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          setSnackbar({
            open: true,
            message: 'File downloaded successfully!',
            severity: 'success',
          });
        }
      } else {
        const data = await response.json();
        setSnackbar({
          open: true,
          message: data.message || 'Failed to download file',
          severity: 'error',
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message || 'Failed to download file',
        severity: 'error',
      });
    }
    handleMenuClose();
  };

  const handleView = () => {
    if (!selectedItem) return;
    
    if (selectedItem.isShared) {
      // For shared items, navigate to the shared item's path
      const path = `${selectedItem.sharedBy}/${selectedItem.name}`;
      navigate(`/explorer/${path}`);
    } else {
      navigate(`/explorer/${selectedItem.name}`);
    }
    handleMenuClose();
  };

  const handleShare = async () => {
    if (!shareUsername.trim() || !selectedItem) return;
    const itemToShare = selectedItem.isShared ? selectedItem.node : selectedItem;
    console.log("itemToShare:", itemToShare);
    
    try {
      const data = await fileAPI.shareItem(shareUsername, itemToShare);

      if (data.message === 'SUCCESS') {
        setSnackbar({
          open: true,
          message: 'Item shared successfully!',
          severity: 'success',
        });
        setShareDialogOpen(false);
        setShareUsername('');
      } else {
        setSnackbar({
          open: true,
          message: data.message || 'Failed to share item',
          severity: 'error',
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.message || 'Network error. Please try again.',
        severity: 'error',
      });
    }
    handleMenuClose();
  };

  const renderRootItems = () => {
    if (!rootData || !rootData.children) return null;

    return Object.entries(rootData.children).map(([name, item]) => (
      <Grid item xs={12} sm={6} md={4} lg={3} key={name}>
        <Card
          sx={{
            height: '100%',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: 6,
            },
          }}
        >
          <Box sx={{ position: 'relative' }}>
            <CardActionArea
              onClick={() => handleFileClick(name, item)}
              sx={{ height: '100%', p: 2 }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                {item.is_folder ? (
                  <Folder sx={{ fontSize: 48, color: 'primary.main' }} />
                ) : (
                  <InsertDriveFile sx={{ fontSize: 48, color: 'text.secondary' }} />
                )}
                <Typography
                  variant="subtitle1"
                  align="center"
                  sx={{
                    fontWeight: 500,
                    wordBreak: 'break-word',
                  }}
                >
                  {name}
                </Typography>
                {!item.is_folder && item.file_obj && (
                  <Chip
                    label={`${(item.file_obj.size / 1024).toFixed(1)} KB`}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
            </CardActionArea>
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 1,
              }}
            >
              <Tooltip title="More options">
                <IconButton
                  onClick={(e) => handleMenuOpen(e, { name, ...item })}
                  size="small"
                  sx={{
                    bgcolor: 'background.paper',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <MoreVert />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Card>
      </Grid>
    ));
  };

  const renderSharedItems = () => {
    let sharedItemsArray = [];
    
    if (shareList && typeof shareList === 'object') {
      Object.entries(shareList).forEach(([fromUser, nodes]) => {
        if (Array.isArray(nodes)) {
          nodes.forEach(node => {
            sharedItemsArray.push({
              name: node.name || 'Shared Item',
              sharedBy: fromUser,
              node: node,
              is_folder: node.is_folder
            });
          });
        }
      });
    }

    if (sharedItemsArray.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          No shared items yet
        </Typography>
      );
    }

    return (
      <Grid container spacing={2}>
        {sharedItemsArray.map((item, index) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
            <Card
              sx={{
                height: '100%',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                },
              }}
            >
              <Box sx={{ position: 'relative' }}>
                <CardActionArea
                  onClick={() => item.is_folder ? handleFolderClick(`${item.sharedBy}/${item.name}`) : handleDownload(item)}
                  sx={{ height: '100%', p: 2 }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    {item.is_folder ? (
                      <Folder sx={{ fontSize: 48, color: 'primary.main' }} />
                    ) : (
                      <InsertDriveFile sx={{ fontSize: 48, color: 'text.secondary' }} />
                    )}
                    <Typography
                      variant="subtitle1"
                      align="center"
                      sx={{
                        fontWeight: 500,
                        wordBreak: 'break-word',
                      }}
                    >
                      {item.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      align="center"
                    >
                      Shared by {item.sharedBy}
                    </Typography>
                    {!item.is_folder && item.node.file_obj && (
                      <Chip
                        label={`${(item.node.file_obj.size / 1024).toFixed(1)} KB`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </CardActionArea>
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 1,
                  }}
                >
                  <Tooltip title="More options">
                    <IconButton
                      onClick={(e) => handleMenuOpen(e, item, true)}
                      size="small"
                      sx={{
                        bgcolor: 'background.paper',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                      }}
                    >
                      <MoreVert />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  const speedDialActions = [
    {
      icon: <CreateNewFolder />,
      name: 'Create Folder',
      onClick: handleCreateFolder,
    },
    {
      icon: <Upload />,
      name: 'Upload File',
      onClick: handleUploadFile,
    },
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileSelected}
        title="Maximum file size: 1 MB"
      />

      {/* Welcome Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          Welcome back, {user}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your files and folders with ease
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Left Side - My Files and Shared With Me */}
        <Grid item size ={{xs: 20, sm:9}}>
          {/* My Files Section */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Storage sx={{ mr: 2, color: 'primary.main' }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                My Files
              </Typography>
            </Box>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Maximum file size: 1 MB
              </Typography>
              
              {/* AI Processing Toggle */}
              <FormControlLabel
                control={
                  <Switch
                    checked={aiModeEnabled}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      console.log('[HomePage] AI toggle changed to', enabled);
                      setAiModeEnabled(enabled);
                      localStorage.setItem('aiModeEnabled', JSON.stringify(enabled));
                    }}
                    color="primary"
                    size="small"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {aiModeEnabled ? (
                      <Psychology sx={{ fontSize: 16, color: 'primary.main' }} />
                    ) : (
                      <SmartToy sx={{ fontSize: 16, color: 'text.secondary' }} />
                    )}
                    <Typography variant="caption" color="text.secondary">
                      AI {aiModeEnabled ? 'On' : 'Off'}
                    </Typography>
                  </Box>
                }
                sx={{ m: 0 }}
              />
            </Box>
            <Grid container spacing={2}>
              {renderRootItems()}
              {(!rootData || !rootData.children || Object.keys(rootData.children).length === 0) && (
                <Grid item xs={12}>
                  <Box
                    sx={{
                      textAlign: 'center',
                      py: 6,
                      color: 'text.secondary',
                    }}
                  >
                    <Storage sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      No files yet
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      Start by creating a folder or uploading a file
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Maximum file size: 1 MB
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          </Paper>

          {/* Shared with Me Section */}
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Share sx={{ mr: 2, color: 'secondary.main' }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Shared with Me
              </Typography>
            </Box>
            {renderSharedItems()}
          </Paper>
        </Grid>

        {/* Right Side - Stats Cards */}
        <Grid item size ={{xs: 12, sm:3}}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper
                sx={{
                  p: 3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                }}
              >
                <Storage sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {stats.totalFiles}
                  </Typography>
                  <Typography variant="body2">Total Files</Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper
                sx={{
                  p: 3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  color: 'white',
                }}
              >
                <Folder sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {stats.totalFolders}
                  </Typography>
                  <Typography variant="body2">Total Folders</Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Paper
                sx={{
                  p: 3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  color: 'white',
                }}
              >
                <People sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 600 }}>
                    {stats.sharedItems}
                  </Typography>
                  <Typography variant="body2">Shared Items</Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      {/* Speed Dial for Actions */}
      <SpeedDial
        ariaLabel="File actions"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        icon={<SpeedDialIcon />}
        onClose={() => setSpeedDialOpen(false)}
        onOpen={() => setSpeedDialOpen(true)}
        open={speedDialOpen}
      >
        {speedDialActions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={action.onClick}
          />
        ))}
      </SpeedDial>

      {/* Create Folder Dialog */}
      <Dialog open={createFolderOpen} onClose={() => setCreateFolderOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Folder Name"
            fullWidth
            variant="outlined"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleConfirmCreateFolder();
              }
            }}
            helperText="Enter a name for the new folder"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateFolderOpen(false);
            setNewFolderName('');
          }}>
            Cancel
          </Button>
          <Button onClick={handleConfirmCreateFolder} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Progress */}
      {uploading && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 90,
            right: 24,
            minWidth: 300,
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 3,
            p: 2,
            zIndex: 1300,
          }}
        >
          <Typography variant="body2" sx={{ mb: 1 }}>
            Uploading file...
          </Typography>
          <LinearProgress variant="determinate" value={uploadProgress} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {uploadProgress}% complete
          </Typography>
        </Box>
      )}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        {selectedItem && !selectedItem.is_folder && (
          <MenuItem onClick={handleDownload}>
            <Download sx={{ mr: 2 }} />
            Download
          </MenuItem>
        )}
        <MenuItem onClick={() => setShareDialogOpen(true)}>
          <Share sx={{ mr: 2 }} />
          Share
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 2 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)}>
        <DialogTitle>Share Item</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Username"
            fullWidth
            variant="outlined"
            value={shareUsername}
            onChange={(e) => setShareUsername(e.target.value)}
            helperText="Enter the username of the person you want to share with"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleShare} variant="contained">
            Share
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default HomePage; 