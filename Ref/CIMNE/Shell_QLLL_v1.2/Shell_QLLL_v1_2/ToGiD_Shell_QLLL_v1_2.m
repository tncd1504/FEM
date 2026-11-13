function ToGiD_Shell_QLLL_v1_2(file_name,u,reaction,Strnod,la)

%% ToGiD Writes the postprocess files
%
%  Parameters:
%
%    Input, file_name : GiD File name
%           u         : Nodal displacements
%           reaction  : Nodal reactions
%           Strnod    : Nodal stresses
%   
%    Output, none

  global coordinates;
  global elements;
 
  nelem = size(elements,1);            % Number of elements
  nnode = size(elements,2);            % Number of nodes per element
  npnod = size(coordinates,1);         % Number of nodes
   
  eletyp = 'Quadrilateral';

  msh_file = strcat(file_name,'.flavia.msh');
  res_file = strcat(file_name,'.flavia.res');
  
% Mesh File
  fid = fopen(msh_file,'w');
  fprintf(fid,'### \n');
  fprintf(fid,'# MAT-fem Shell QLLL v1.2 \n');
  fprintf(fid,'# \n');

  fprintf(fid,'MESH dimension %3.0f   Elemtype %s   Nnode %2.0f \n \n', ...
        3,eletyp,nnode);
  fprintf(fid,'coordinates \n');
  for i = 1 : npnod
    fprintf(fid,'%6.0f %12.5d %12.5d  %12.5d \n', ...
        i,coordinates(i,1),coordinates(i,2),coordinates(i,3));
  end
  fprintf(fid,'end coordinates \n \n');
  fprintf(fid,'elements \n');
  for i = 1 : nelem
    fprintf(fid,'%6.0f %6.0f %6.0f %6.0f %6.0f  1 \n',i,elements(i,:));
  end
  fprintf(fid,'end elements \n \n');
 
  status = fclose(fid);
  
% Results File
  fid = fopen(res_file,'w');
  fprintf(fid,'Gid Post Results File 1.0 \n');
  fprintf(fid,'### \n');
  fprintf(fid,'# MAT-fem Shell QLLL v1.2 \n');
  fprintf(fid,'# \n');
  
  fprintf(fid,'GaussPoints "GPTR" ElemType Quadrilateral  \n');
  fprintf(fid,'Number Of Gauss Points: 1  \n');
  fprintf(fid,'Natural Coordinates: Internal  \n');
  fprintf(fid,'End gausspoints \n');

% Displacement
  u = full(u);
  fprintf(fid,'Result "Displacement" "Load Analysis"  1  Vector OnNodes \n');
  fprintf(fid,'ComponentNames "X-Displ", "Y-Displ", "Z-Displ" \n');
  fprintf(fid,'Values \n');
  for i = 1 : npnod
    fprintf(fid,'%6.0i %13.5d  %13.5d  %13.5d \n',...
        i,u((i-1)*5+1),u((i-1)*5+2),u((i-1)*5+3));
  end
  fprintf(fid,'End Values \n');
  fprintf(fid,'# \n');

% Rotation
  fprintf(fid,'Result "Rotation" "Load Analysis"  1  Vector OnNodes \n');
  fprintf(fid,'ComponentNames "X-Rot", "Y-Rot", "Z-Rot" \n');
  fprintf(fid,'Values \n');
  for i = 1 : npnod
    fprintf(fid,'%6.0i %13.5d %13.5d 0.0  \n',i,u((i-1)*5+4),u((i-1)*5+5));
  end
  fprintf(fid,'End Values \n');
  fprintf(fid,'# \n');

% Reaction Force
  fprintf(fid,'Result "Reaction Force" "Load Analysis"  1  Vector OnNodes \n');
  fprintf(fid,'ComponentNames "X-Force", "Y-Force", "Z-Force" \n');
  fprintf(fid,'Values \n');
  for i = 1 : npnod
    fprintf(fid,'%6.0i %13.5d %13.5d %13.5d  \n',i, ...
    full(reaction((i-1)*5+1)),full(reaction((i-1)*5+2)),full(reaction((i-1)*5+3)));
  end
  fprintf(fid,'End Values \n');
  fprintf(fid,'# \n');
  
% Reaction Moment
  fprintf(fid,'Result "Reaction Moment" "Load Analysis"  1  Vector OnNodes \n');
  fprintf(fid,'ComponentNames "Local-X-Moment", "Local-Y-Moment", "Local-Z-Moment" \n');
  fprintf(fid,'Values \n');
  for i = 1 : npnod
    fprintf(fid,'%6.0i %13.5d %13.5d %13.5d  \n',i, ...
    full(reaction((i-1)*5+4)),full(reaction((i-1)*5+5)),0.0);
  end
  fprintf(fid,'End Values \n');
  fprintf(fid,'# \n');

% Local Moment
  fprintf(fid,'Result "Local Moment" "Load Analysis"  1  Vector OnNodes \n');
  fprintf(fid,'ComponentNames "Mx", "My", "Mxy" \n');
  fprintf(fid,'Values \n');
  for i = 1 : npnod
    fprintf(fid,'%6.0f %13.5d  %13.5d  %13.5d \n', ...
        i,Strnod(i,1),Strnod(i,2),Strnod(i,3));
  end
  fprintf(fid,'End Values \n');  

% Local Membrane
  fprintf(fid,'Result "Local Membrane" "Load Analysis"  1  Vector OnNodes \n');
  fprintf(fid,'ComponentNames "Nx", "Ny", "Nxy" \n');
  fprintf(fid,'Values \n');
  for i = 1 : npnod
    fprintf(fid,'%6.0f %13.5d  %13.5d  %13.5d \n', ...
        i,Strnod(i,4),Strnod(i,5),Strnod(i,6));
  end
  fprintf(fid,'End Values \n');  

% Local Shear
  fprintf(fid,'Result "Local Shear" "Load Analysis"  1  Vector OnNodes \n');
  fprintf(fid,'ComponentNames "Qx", "Qy", "Zeros" \n');
  fprintf(fid,'Values \n');
  for i = 1 : npnod
    fprintf(fid,'%6.0f %13.5d  %13.5d  0.0 \n', ...
        i,Strnod(i,7),Strnod(i,8));
  end
  fprintf(fid,'End Values \n');  

% X vector
  fprintf(fid,'Result "X vector" "Load Analysis"  1  Vector OnGaussPoints "GPTR" \n');
  fprintf(fid,'ComponentNames "XX", "XY", "XZ" \n');
  fprintf(fid,'Values \n');
  
  for i = 1 : nelem
    fprintf(fid,'%6.0i %13.5d %13.5d %13.5d  \n',i,la(i,1:3));
  end
  fprintf(fid,'End Values \n');
  fprintf(fid,'# \n');
  
% Y vector
  fprintf(fid,'Result "Y vector" "Load Analysis"  1  Vector OnGaussPoints "GPTR" \n');
  fprintf(fid,'ComponentNames "YX", "YY", "YZ" \n');
  fprintf(fid,'Values \n');
  
  for i = 1 : nelem
    fprintf(fid,'%6.0i %13.5d %13.5d %13.5d  \n',i,la(i,4:6));
  end
  fprintf(fid,'End Values \n');
  fprintf(fid,'# \n');
  
% Z vector
  fprintf(fid,'Result "Z vector" "Load Analysis"  1  Vector OnGaussPoints "GPTR" \n');
  fprintf(fid,'ComponentNames "ZX", "ZY", "ZZ" \n');
  fprintf(fid,'Values \n');
  
  for i = 1 : nelem
    fprintf(fid,'%6.0i %13.5d %13.5d %13.5d  \n',i,la(i,7:9));
  end
  fprintf(fid,'End Values \n');
  fprintf(fid,'# \n');
  
  status = fclose(fid);

