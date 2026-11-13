function ToGiD3D_v1_2(file_name,u,reaction,Strnod)

%% ToGiD3D Writes the postprocess files
%
%  Parameters:
%
%    Input, file_name : GiD File name
%           u         : Nodal displacements
%           reaction  : Reactions on fixed nodes
%           Strnod    : Nodal Stresses
%   
%    Output, none

  global coordinates;
  global elements;
 
  nelem = size(elements,1);            % Number of elements
  nnode = size(elements,2);            % Number of nodes per element
  npnod = size(coordinates,1);         % Number of nodes

  if (nnode == 4)
    eletyp = 'Tetrahedra';
  else
    eletyp = 'Hexahedra';
  end

  msh_file = strcat(file_name,'.flavia.msh');
  res_file = strcat(file_name,'.flavia.res');
  
% Mesh File
  fid = fopen(msh_file,'w');
  fprintf(fid,'### \n');
  fprintf(fid,'# MAT-fem3D v1.2 \n');
  fprintf(fid,'# \n');
  fprintf(fid,'MESH dimension %3.0f   Elemtype %s   Nnode %2.0f \n \n',3,eletyp,nnode);
  fprintf(fid,'coordinates \n');
  for i = 1 : npnod
    fprintf(fid,'%6.0f %12.5d %12.5d  %12.5d \n',i,coordinates(i,:));
  end
  fprintf(fid,'end coordinates \n \n');
  fprintf(fid,'elements \n');
  if (nnode == 4)
    for i = 1 : nelem
      fprintf(fid,'%6.0f %6.0f %6.0f %6.0f %6.0f  1 \n',i,elements(i,:));
    end
  else
    for i = 1 : nelem
      fprintf(fid,'%6.0f %6.0f %6.0f %6.0f %6.0f %6.0f %6.0f %6.0f %6.0f 1 \n',i,elements(i,:));
    end
  end 
  fprintf(fid,'end elements \n \n');
 
  status = fclose(fid);
  
% Results File
  fid = fopen(res_file,'w');
  fprintf(fid,'Gid Post Results File 1.0 \n');
  fprintf(fid,'### \n');
  fprintf(fid,'# MAT-fem3D v1.2 \n');
  fprintf(fid,'# \n');
  
% Displacement
  fprintf(fid,'Result "Displacement" "Load Analysis"  1  Vector OnNodes \n');
  fprintf(fid,'ComponentNames "X-Displ", "Y-Displ", "Z-Displ" \n');
  fprintf(fid,'Values \n');
  for i = 1 : npnod
    fprintf(fid,'%6.0i %13.5d %13.5d %13.5d \n', ...
            i,full(u(i*3-2)),full(u(i*3-1)),full(u(i*3)));
  end
  fprintf(fid,'End Values \n');
  fprintf(fid,'# \n');
  
% Reaction Force
  fprintf(fid,'Result "Reaction Force" "Load Analysis"  1  Vector OnNodes \n');
  fprintf(fid,'ComponentNames "Rx", "Ry", "Rz" \n');
  fprintf(fid,'Values \n');
  for i = 1 : npnod
    fprintf(fid,'%6.0f %12.5d %12.5d  %12.5d \n', ...
         i,full(reaction(i*3-2)),full(reaction(i*3-1)),full(reaction(i*3)));
  end
  fprintf(fid,'End Values \n');
  fprintf(fid,'# \n');
  
% Stress
  fprintf(fid,'Result "Stress" "Load Analysis"  1  Matrix OnNodes \n');
  fprintf(fid,'ComponentNames "Sx", "Sy", "Sz", "Sxy", "Syz", "Sxz" \n');
  fprintf(fid,'Values \n');
  
  for i = 1 : npnod
    fprintf(fid,'%6.0f %12.5d %12.5d %12.5d %12.5d %12.5d %12.5d \n',i,Strnod(i,:));
  end

  fprintf(fid,'End Values \n');
  status = fclose(fid);

