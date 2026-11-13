function ToGiD_Composite_Beam_Timoshenko(file_name,layers,coord_ZG,u,Dsp_lyr,Str_lyr,ResStr_lyr)
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
 

  nelem  = size(elements,1);           % Number of elements
  npnod  = size(coordinates,1);        % Number of nodes
  
  qeletyp = 'Quadrilateral';
  
  msh_file = strcat(file_name,'.flavia.msh');
  res_file = strcat(file_name,'.flavia.res');
  
%% Mesh with quadrilateral elements (2D beam)
qnelem = nelem*layers;            % Number of quadrilateral elements
qnnode = 4;                       % Number of nodes per quadrilateral elements.
qnpnod = npnod*layers*2;          % Number of nodes 

% Coordinates matrix of quadrilateral elements (2D)

qcoordinates = zeros(qnpnod,2);
for i=1:layers
    for j=1:npnod
        qcoordinates((2*i-2)*npnod+j,:)=[coordinates(j) coord_ZG(i)];
        qcoordinates((2*i-1)*npnod+j,:)=[coordinates(j) coord_ZG(i+1)];
    end
end

% Elements matrix of quadrilateral elements (2D)

qelements=zeros(qnelem,qnnode+1);
  for i = 1:layers
    for j = 1 : nelem
      qelements((i-1)*nelem+j,:) = [((2*i-2)*npnod+ elements(j,:))...
          ((2*i-1)*npnod + elements(j,end:-1:1))  i];
    end
  end
 
% Conectivity matrix by layer (2D)  

  Nod_lyr  = zeros(npnod,layers,2);       
  Elem_lyr = zeros(nelem,layers);
  for i = 1 : layers
      for j = 1 : npnod
          Nod_lyr(j,i,1) = (2*i-2)*npnod + j;
          Nod_lyr(j,i,2) = (2*i-1)*npnod + j;
      end
      for n = 1 : nelem
          Elem_lyr(n,i) = (i-1)*nelem + n;
      end
  end

%%Generates the mesh file

  fid = fopen(msh_file,'w');
  fprintf(fid,'### \n');
  fprintf(fid,'# MAT_FEM Compiste Laminated TBT \n');
  fprintf(fid,'# \n');

  
% Generates the mesh in 2D
  fprintf(fid,'Group "Thickness_Analysis_2D" \n');
  fprintf(fid,'MESH "2D_beam" dimension %3.0f   Elemtype %s   Nnode %2.0f \n \n',2,qeletyp,qnnode);
  fprintf(fid,'coordinates \n');
  for i = 1 : qnpnod
    fprintf(fid,'%6.0f %12.5d %12.5d \n',i,qcoordinates(i,1),qcoordinates(i,2));
  end
  fprintf(fid,'end coordinates \n \n');
  fprintf(fid,'elements \n');
  for i = 1 : qnelem
    fprintf(fid,'%6.0f %6.0f %6.0f  %6.0f %6.0f %3.0f \n',i,qelements(i,:));
  end
  fprintf(fid,'end elements \n \n');
  fprintf(fid,'end group \n \n');
  
  status = fclose(fid);
  
%% Generates the result file

  fid = fopen(res_file,'w');
  fprintf(fid,'Gid Post Results File 1.0 \n');
  fprintf(fid,'### \n');
  fprintf(fid,'# MAT_FEM Composite Laminated TBT \n');
  fprintf(fid,'# \n');
  fprintf(fid,'GaussPoints "GP_quad" Elemtype %s "2D_beam" \n',qeletyp);
  fprintf(fid,'Number of Gauss Points: 1 \n');
  fprintf(fid,'Natural Coordinates: Internal \n');
  fprintf(fid,'end gausspionts \n');
  fprintf(fid,'# \n');
  
  
%% Thickness results along each layer

  fprintf(fid,'OnGroup "Thickness_Analysis_2D" \n'); 
  fprintf(fid,'Result "Displacements" "Load Analysis" 1 Vector OnNodes \n');
  fprintf(fid,'ComponentNames "X-Displ", "Y-Displ", "Z-Displ" \n');
  fprintf(fid,'Values \n');
  for i=1:layers
      for j = 1 : npnod
    fprintf(fid,'%6.0i %13.5d %13.5d 0.0  \n',Nod_lyr(j,i,1),full(Dsp_lyr(j,1,i)),full(Dsp_lyr(j,2,i)));
    fprintf(fid,'%6.0i %13.5d %13.5d 0.0  \n',Nod_lyr(j,i,2),full(Dsp_lyr(j,1,i+1)),full(Dsp_lyr(j,2,i+1)));
      end
  end    
  fprintf(fid,'End Values \n');
  fprintf(fid,'# \n');
  
  fprintf(fid,'Result "Rotation" "Load Analysis" 1 Vector OnNodes \n');
  fprintf(fid,'ComponentNames "X-Rot", "Y-Rot", "Z-Rot" \n');
  fprintf(fid,'Values \n');
  for i=1:layers
      for j = 1 : npnod
    fprintf(fid,'%6.0i 0.0 0.0 %13.5d  \n',Nod_lyr(j,i,1),full(Dsp_lyr(j,3,i)));
    fprintf(fid,'%6.0i 0.0 0.0 %13.5d  \n',Nod_lyr(j,i,2),full(Dsp_lyr(j,3,i+1)));
      end
  end    
  fprintf(fid,'End Values \n');
  fprintf(fid,'# \n');
  
  fprintf(fid,'Result "Stresses" "Load Analysis" 1 Vector OnNodes \n');
  fprintf(fid,'ComponentNames "Sigma_x", "Tau_xz", "zero" \n');
  fprintf(fid,'Values \n');
 for i=1:layers
      for j = 1 : npnod
    fprintf(fid,'%6.0i %12.5d %12.5d 0.0 \n',Nod_lyr(j,i,1),Str_lyr(j,1,(i-1)*2+1),Str_lyr(j,2,(i-1)*2+1));
    fprintf(fid,'%6.0i %12.5d %12.5d 0.0 \n',Nod_lyr(j,i,2),Str_lyr(j,1,(i-1)*2+2),Str_lyr(j,2,(i-1)*2+2));
      end
  end    
  fprintf(fid,'End Values \n');
  fprintf(fid,'# \n'); 
  
  fprintf(fid,'Result "Resultant_Stresses" "Load Analysis" 1 Vector OnGaussPoints "GP_quad" \n');
  fprintf(fid,'ComponentNames "Nx", "Qy", "Mz" \n');
  fprintf(fid,'Values \n');
 for i=1:layers
      for j = 1 : nelem
    fprintf(fid,'%6.0i %12.5d %12.5d %12.5d  \n',Elem_lyr(j,i),ResStr_lyr(j,1,i),ResStr_lyr(j,3,i),ResStr_lyr(j,2,i));
      end
  end  
  fprintf(fid,'End Values \n');
  fprintf(fid,'End ongroup \n');
  fprintf(fid,'# \n');  
  
  status = fclose(fid);





