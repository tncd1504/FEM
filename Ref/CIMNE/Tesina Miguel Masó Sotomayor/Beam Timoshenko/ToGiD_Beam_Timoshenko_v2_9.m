function ToGiD_Beam_Timoshenko_v2_9 (file_name,zlayr,u,reaction,Strnod,lDspNod,lStrNod,lResStrGP)
%
%  Parameters:
%
%    Input,  file_name : GiD File name
%            u         : Nodal variables
%            reaction  : Nodal reactions
%            Str       : Gauss Point Stresses
%   
%    Output, none
%
  global coordinates;
  global elements;
 
  nlayr  = size(zlayr,1) - 1;          % Number of section layers
  nelem  = size(elements,1);           % Number of elements
  nnode  = size(elements,2);           % Number of nodes per element
  npnod  = size(coordinates,1);        % Number of nodes
  dofpn  = 3;                          % Number of DOF per node

  eletyp = 'Linear';
  leletyp = 'Quadrilateral';
  
  msh_file = strcat(file_name,'.post.msh');
  res_file = strcat(file_name,'.post.res');
  
%% Build the Thickness Analysis mesh
  lnnode = 4;                          % New number of nodes per element
  lnpnod = npnod*nlayr*2;              % New number of nodes
  lnelem = nelem*nlayr;                % New number of elements

  lcoordinates = zeros(lnpnod,2);      % Build new coordinates matrix
  for l = 1 : nlayr
    for i = 1 : npnod
      lcoordinates((2*l-2)*npnod+i,:) = [coordinates(i) zlayr( l )];
      lcoordinates((2*l-1)*npnod+i,:) = [coordinates(i) zlayr(l+1)];
    end
  end
  lelements = zeros(lnelem,lnnode+1);  % Build new connetivity matrix
  for l = 1 : nlayr
    for j = 1 : nelem
      lelements((l-1)*nelem+j,:) = [((2*l-2)*npnod + elements(j,:))...
          ((2*l-1)*npnod + elements(j,end:-1:1))  l];
    end
  end
  
  nodlay  = zeros(npnod,nlayr,2);       % Pseudo-connectivity matrices
  elemlay = zeros(nelem,nlayr);
  for l = 1 : nlayr
      for n = 1 : npnod
          nodlay(n,l,1) = (2*l-2)*npnod + n;
          nodlay(n,l,2) = (2*l-1)*npnod + n;
      end
      for n = 1 : nelem
          elemlay(n,l) = (l-1)*nelem + n;
      end
  end
  
%% Print the mesh file
  fid = fopen(msh_file,'w');
  fprintf(fid,'### \n');
  fprintf(fid,'# MAT_FEM Beam Timoshenko  v.2.4 \n');
  fprintf(fid,'# \n');
  
% Print the Section Analysis mesh (1D)
  fprintf(fid,'Group "Section_Analysis" \n');
  fprintf(fid,'MESH "Section_mesh"  dimension %3.0f  Elemtype %s  Nnode %2.0f  \n \n',2,eletyp,nnode);
  fprintf(fid,'# color 0 255 0 0 \n');
  fprintf(fid,'coordinates \n');
  for i = 1 : npnod
    fprintf(fid,'%6.0f %12.5d 0.0 \n',i,coordinates(i,1));
  end
  fprintf(fid,'end coordinates \n \n');
  fprintf(fid,'elements \n');
  for i = 1 : nelem
    fprintf(fid,'%6.0f   %6.0f %6.0f  1 \n',i,elements(i,:));
  end
  fprintf(fid,'end elements \n \n');
  fprintf(fid,'end group \n \n');

% Print the Thickness Analysis mesh (2D)
  fprintf(fid,'Group "Layer_Analysis" \n');
  fprintf(fid,'MESH "Layer_mesh"  dimension %3.0f  Elemtype %s  Nnode %2.0f \n \n',2,leletyp,lnnode);
  fprintf(fid,'coordinates \n');
  for i = 1 : lnpnod
    fprintf(fid,'%6.0f %12.5d %12.5d \n',i,lcoordinates(i,1),lcoordinates(i,2));
  end
  fprintf(fid,'end coordinates \n \n');
  fprintf(fid,'elements \n');
  for i = 1 : lnelem
    fprintf(fid,'%6.0f   %6.0f %6.0f %6.0f %6.0f  %3.0f \n',i,lelements(i,:));
  end
  fprintf(fid,'end elements \n \n');
  fprintf(fid,'end group \n \n');
 
  status = fclose(fid);
  
%% Print the results file headder
  fid = fopen(res_file,'w');
  fprintf(fid,'Gid Post Results File 1.0 \n');
  fprintf(fid,'### \n');
  fprintf(fid,'# MAT_FEM Beam Timoshenko  v.2.9 \n');
  fprintf(fid,'# \n');
  fprintf(fid,'GaussPoints "GPQuad1"  Elemtype %s  "Layer_mesh" \n',leletyp);
  fprintf(fid,'Number of Gauss Points: 1 \n');
  fprintf(fid,'Natural Coordinates: Internal \n');
  fprintf(fid,'end gausspionts \n');
  fprintf(fid,'# \n');

%% Print the section results
  fprintf(fid,'OnGroup "Section_Analysis" \n');
  fprintf(fid,'Result "Displacements" "Analysis"  1  Vector OnNodes \n');
  fprintf(fid,'ComponentNames "X-Displ", "Y-Displ", "Z-Displ" \n');
  fprintf(fid,'Values \n');
  for i = 1 : npnod
    fprintf(fid,'%6.0i %13.5d %13.5d 0.0  \n',i,full(u((i-1)*dofpn+1)),full(u((i-1)*dofpn+2)));
  end
  fprintf(fid,'End Values \n');
  fprintf(fid,'# \n');
  
  fprintf(fid,'Result "Rotation" "Analysis"  1  Vector OnNodes \n');
  fprintf(fid,'ComponentNames "X-Rot", "Y-Rot", "Z-Rot" \n');
  fprintf(fid,'Values \n');
  for i = 1 : npnod
    fprintf(fid,'%6.0i 0.0 0.0 %13.5d \n',i,full(u((i-1)*dofpn+3)));
  end
  fprintf(fid,'End Values \n');
  fprintf(fid,'# \n');
  
  fprintf(fid,'Result "Force Reactions" "Analysis"  1  Vector OnNodes \n');
  fprintf(fid,'ComponentNames "X-React", "Y-React", "Z-React" \n');
  fprintf(fid,'Values \n');
  for i = 1 : npnod
    fprintf(fid,'%6.0i %13.5d %13.5d 0.0  \n',i,full(reaction((i-1)*dofpn+1)),full(reaction((i-1)*dofpn+2)));
  end
  fprintf(fid,'End Values \n');
  fprintf(fid,'# \n');
  
  fprintf(fid,'Result "Moment Reactions" "Analysis"  1  Vector OnNodes \n');
  fprintf(fid,'ComponentNames "X-Moment", "Y-Moment", "Z-Moment" \n');
  fprintf(fid,'Values \n');
  for i = 1 : npnod
    fprintf(fid,'%6.0i 0.0 0.0 %13.5d \n',i,full(reaction((i-1)*dofpn+3)));
  end
  fprintf(fid,'End Values \n');
  fprintf(fid,'# \n');
  
  fprintf(fid,'Result "Resultant_Stresses" "Analysis"  1  Vector OnNodes \n');
  fprintf(fid,'ComponentNames "Nx", "Qy", "Mz" \n');
  fprintf(fid,'Values \n');
  for i = 1 : npnod
    fprintf(fid,'%6.0f %12.5d  %12.5d  %12.5d \n',i,Strnod(i,1),Strnod(i,3),Strnod(i,2));
  end
  fprintf(fid,'End Values \n');
  fprintf(fid,'End ongroup \n');
  fprintf(fid,'# \n');
  fprintf(fid,'# \n');

%% Print the thickness results
  fprintf(fid,'OnGroup "Layer_Analysis" \n');
  fprintf(fid,'Result "Displacements" "Analysis" 2  Vector OnNodes \n');
  fprintf(fid,'ComponentNames "X-Displ", "Y-Displ", "Z-Displ" \n');
  fprintf(fid,'Values \n');
  for l = 1 : nlayr
    for i = 1 : npnod
      fprintf(fid,'%6.0i %13.5d %13.5d 0.0  \n',nodlay(i,l,1),full(lDspNod(i,1, l )),full(lDspNod(i,2, l )));
      fprintf(fid,'%6.0i %13.5d %13.5d 0.0  \n',nodlay(i,l,2),full(lDspNod(i,1,l+1)),full(lDspNod(i,2,l+1)));      
    end
  end
  fprintf(fid,'End Values \n');
  fprintf(fid,'# \n');

  fprintf(fid,'Result "Rotation" "Analysis" 2  Vector OnNodes \n');
  fprintf(fid,'ComponentNames "X-Rot", "Y-Rot", "Z-Rot" \n');
  fprintf(fid,'Values \n');
  for l = 1 : nlayr
    for i = 1 : npnod
      fprintf(fid,'%6.0i 0.0 0.0 %13.5d \n',nodlay(i,l,1),full(lDspNod(i,3, l )));
      fprintf(fid,'%6.0i 0.0 0.0 %13.5d \n',nodlay(i,l,2),full(lDspNod(i,3,l+1)));
    end
  end
  fprintf(fid,'End Values \n');
  fprintf(fid,'# \n');
  
  fprintf(fid,'Result "Stresses" "Analysis" 2  Vector OnNodes \n');
  fprintf(fid,'ComponentNames "Sigma-x", "Tau-xz", "zero" \n');
  fprintf(fid,'Values \n');
  for l = 1 : nlayr
    for i = 1 : npnod
      fprintf(fid,'%6.0i %12.5d  %12.5d  0 \n',nodlay(i,l,1),lStrNod(i,1,(l-1)*2+1),lStrNod(i,2,(l-1)*2+1));
      fprintf(fid,'%6.0i %12.5d  %12.5d  0 \n',nodlay(i,l,2),lStrNod(i,1,(l-1)*2+2),lStrNod(i,2,(l-1)*2+2));
    end
  end
  fprintf(fid,'End Values \n');
  fprintf(fid,'# \n');

  fprintf(fid,'Result "Resultant_Stresses" "Analysis" 2  Vector OnGaussPoints "GPQuad1" \n');
  fprintf(fid,'ComponentNames "Nx", "Qy", "Mz" \n');
  fprintf(fid,'Values \n');
  for l = 1 : nlayr
    for i = 1 : nelem
      fprintf(fid,'%6.0i %12.5d  %12.5d  %12.5d \n',elemlay(i,l),lResStrGP(i,1,l),lResStrGP(i,3,l),lResStrGP(i,2,l));
    end
  end
  fprintf(fid,'End Values \n');
  fprintf(fid,'End ongroup \n');
  fprintf(fid,'# \n');

  status = fclose(fid);


  